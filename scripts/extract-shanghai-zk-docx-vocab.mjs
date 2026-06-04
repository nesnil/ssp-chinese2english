import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const docxPath = path.resolve("docs/上海市中考英语考纲-看英文默写中文.docx");
const outputDir = path.resolve("middle-school-wordlist/data");
const jsonPath = path.join(outputDir, "shanghai-zhongkao-vocab.json");
const csvPath = path.join(outputDir, "shanghai-zhongkao-vocab.csv");
const wordStart = 1;
const wordEnd = 1736;

function decodeXml(value) {
  return String(value || "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_match, code) => String.fromCharCode(Number(code)));
}

function cellText(xml) {
  const parts = [];
  for (const match of xml.matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g)) {
    parts.push(decodeXml(match[1]));
  }
  return parts.join("").replace(/\s+/g, " ").trim();
}

function tableRows(documentXml) {
  const rows = [];
  for (const rowMatch of documentXml.matchAll(/<w:tr\b[\s\S]*?<\/w:tr>/g)) {
    const cells = [];
    for (const cellMatch of rowMatch[0].matchAll(/<w:tc\b[\s\S]*?<\/w:tc>/g)) {
      cells.push(cellText(cellMatch[0]));
    }
    if (cells.length) rows.push(cells);
  }
  return rows;
}

function normalizeText(value) {
  return String(value || "")
    .replace(/[（）]/g, (char) => (char === "（" ? "(" : ")"))
    .replace(/[’]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function addVariant(set, value) {
  const cleaned = normalizeText(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/^[().,\s]+|[().,\s]+$/g, "")
    .replace(/\s+([.])/g, "$1")
    .trim();
  if (!cleaned || !/[A-Za-z]/.test(cleaned)) return;
  set.add(cleaned);

  if (/[.]/.test(cleaned)) {
    const dotless = cleaned.replace(/[.\s]/g, "");
    if (/^[A-Za-z]+$/.test(dotless)) set.add(dotless);
  }

  if (/^the\s+/i.test(cleaned)) {
    addVariant(set, cleaned.replace(/^the\s+/i, ""));
  }
}

function addSplitVariants(set, value) {
  for (const part of String(value || "").split(/\s*(?:\/|=|,)\s*/)) {
    addVariant(set, part);
  }
}

function addCompactVariants(set, value) {
  const compact = normalizeText(value).match(/^([A-Za-z]+)\(([A-Za-z]+)\)([A-Za-z]+)$/);
  if (compact) {
    addVariant(set, `${compact[1]}${compact[3]}`);
    addVariant(set, `${compact[1]}${compact[2]}${compact[3]}`);
  }

  const optionalSuffix = normalizeText(value).match(/^([A-Za-z]+)\(([A-Za-z]+)\)$/);
  if (optionalSuffix) {
    addVariant(set, optionalSuffix[1]);
    addVariant(set, `${optionalSuffix[1]}${optionalSuffix[2]}`);
  }
}

function sourceVariants(rawWord) {
  const cleaned = normalizeText(rawWord);
  if (!cleaned) return [];

  const variants = new Set();
  addCompactVariants(variants, cleaned);

  const withoutParentheses = cleaned.replace(/\([^)]*\)/g, "");
  addSplitVariants(variants, withoutParentheses);

  const initial = cleaned.match(/^[A-Za-z][A-Za-z.'-]*(?:\s+[A-Za-z][A-Za-z.'-]*)?/);
  if (initial) addVariant(variants, initial[0]);

  for (const match of cleaned.matchAll(/\(([^)]*)\)/g)) {
    const inner = normalizeText(match[1]);
    if (!inner) continue;
    if (/^=/.test(inner)) {
      addSplitVariants(variants, inner.replace(/^=/, ""));
    } else if (/美/.test(inner)) {
      const english = inner.replace(/美/g, " ");
      addSplitVariants(variants, english);
    } else if (!/[\u3400-\u9fff]/.test(inner) && !/[,;]/.test(inner)) {
      addSplitVariants(variants, inner);
    }
  }

  return [...variants].filter(Boolean);
}

function csvEscape(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

async function main() {
  const { stdout } = await execFileAsync("unzip", ["-p", docxPath, "word/document.xml"], {
    maxBuffer: 20 * 1024 * 1024
  });

  const numberedRows = new Map();
  for (const cells of tableRows(stdout)) {
    if (cells.length < 2 || !/^\d+$/.test(cells[0])) continue;
    const no = Number(cells[0]);
    if (no < wordStart || no > wordEnd) continue;
    numberedRows.set(no, {
      no,
      rawWord: normalizeText(cells[1]),
      cells
    });
  }

  const missingNumbers = [];
  const blankRows = [];
  const words = [];
  for (let no = wordStart; no <= wordEnd; no += 1) {
    const row = numberedRows.get(no);
    if (!row) {
      missingNumbers.push(no);
      continue;
    }
    if (!row.rawWord) {
      blankRows.push(no);
      continue;
    }
    const variants = sourceVariants(row.rawWord);
    words.push({
      no,
      word: variants[0] || row.rawWord,
      rawWord: row.rawWord,
      variants
    });
  }

  const duplicateWords = new Map();
  for (const entry of words) {
    const key = entry.word.toLowerCase();
    duplicateWords.set(key, [...(duplicateWords.get(key) || []), entry.no]);
  }

  const duplicates = [...duplicateWords.entries()]
    .filter(([, numbers]) => numbers.length > 1)
    .map(([word, numbers]) => ({ word, numbers }));

  const payload = {
    source: "上海市中考英语考纲-看英文默写中文.docx",
    sourcePath: "docs/上海市中考英语考纲-看英文默写中文.docx",
    extractedAt: new Date().toISOString(),
    wordNumberRange: { start: wordStart, end: wordEnd },
    expectedWordSlots: wordEnd - wordStart + 1,
    extractedNumberedRows: numberedRows.size,
    extractedWordRows: words.length,
    missingNumbers,
    blankRows,
    duplicateWords: duplicates,
    words
  };

  const csv = [
    "no,word,raw_word,variants",
    ...words.map((entry) =>
      [entry.no, entry.word, entry.rawWord, entry.variants.join(";")].map(csvEscape).join(",")
    )
  ].join("\n");

  await mkdir(outputDir, { recursive: true });
  await writeFile(jsonPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  await writeFile(csvPath, `${csv}\n`, "utf8");

  console.log(`Expected slots: ${payload.expectedWordSlots}`);
  console.log(`Numbered rows: ${payload.extractedNumberedRows}`);
  console.log(`Extracted non-empty words: ${payload.extractedWordRows}`);
  console.log(`Missing numbers: ${payload.missingNumbers.length}`);
  console.log(`Blank rows: ${payload.blankRows.length}`);
  console.log(`Wrote ${jsonPath}`);
  console.log(`Wrote ${csvPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
