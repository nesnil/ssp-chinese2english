import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const sourcePath = path.resolve("middle-school-wordlist/data/shanghai-zhongkao-vocab.json");
const bankPath = path.resolve("web/generated/word-bank.json");
const outputDir = path.resolve("middle-school-wordlist/data");
const unmatchedCsvPath = path.join(outputDir, "shanghai-zhongkao-unmatched.csv");
const unmatchedJsonPath = path.join(outputDir, "shanghai-zhongkao-unmatched.json");

function normalizeText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizeWordForMatch(value) {
  return normalizeText(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’]/g, "'")
    .replace(/[（）]/g, (char) => (char === "（" ? "(" : ")"))
    .toLowerCase();
}

function addWordVariant(set, value) {
  const normalized = normalizeWordForMatch(value).replace(/^[().,\s]+|[().,\s]+$/g, "");
  if (normalized && /[a-z]/.test(normalized)) {
    set.add(normalized);
    if (/[.]/.test(normalized)) {
      const dotless = normalized.replace(/[.\s]/g, "");
      if (/^[a-z]+$/.test(dotless)) set.add(dotless);
    }
  }
}

function addSplitWordVariants(set, value) {
  for (const part of String(value || "").split(/\s*(?:\/|=|,)\s*/)) {
    addWordVariant(set, part.replace(/^\(|\)$/g, ""));
  }
}

function compactSpellingVariants(value) {
  const match = normalizeText(value).match(/^([A-Za-z]+)\(([A-Za-z]+)\)([A-Za-z]+)$/);
  if (!match) return [];
  return [`${match[1]}${match[3]}`, `${match[1]}${match[2]}${match[3]}`];
}

function wordNameVariants(name) {
  const variants = new Set();
  const cleaned = normalizeText(name).replace(/[（）]/g, (char) => (char === "（" ? "(" : ")"));
  for (const variant of compactSpellingVariants(cleaned)) addWordVariant(variants, variant);

  const base = cleaned.replace(/\s*\([^)]*\)\s*$/g, "");
  addSplitWordVariants(variants, base || cleaned);

  const parenthetical = cleaned.match(/^(.+?)\s*\(([^)]+)\)$/);
  if (parenthetical) {
    const inner = parenthetical[2].trim();
    if (/^=/.test(inner)) {
      addSplitWordVariants(variants, inner.replace(/^=/, ""));
    } else if (!/[\u3400-\u9fff]|\bpl\.?\b/i.test(inner)) {
      addSplitWordVariants(variants, inner);
    }
  }

  for (const variant of [...variants]) {
    if (/^the\s+/i.test(variant)) addWordVariant(variants, variant.replace(/^the\s+/i, ""));
  }
  return variants;
}

function sourceWordVariants(entry) {
  const variants = new Set();
  const values = Array.isArray(entry.variants) && entry.variants.length > 0 ? entry.variants : [entry.word];
  for (const value of values) {
    for (const variant of wordNameVariants(value)) {
      addWordVariant(variants, variant);
    }
  }
  return variants;
}

function csvEscape(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

async function main() {
  const source = JSON.parse(await readFile(sourcePath, "utf8"));
  const bank = JSON.parse(await readFile(bankPath, "utf8"));

  const bankVariantMap = new Map();
  for (const word of bank.words) {
    for (const variant of wordNameVariants(word.name)) {
      const matches = bankVariantMap.get(variant) || [];
      matches.push(word.name);
      bankVariantMap.set(variant, matches);
    }
  }

  const matched = [];
  const unmatchedWords = [];
  for (const entry of source.words) {
    const hits = new Set();
    for (const variant of sourceWordVariants(entry)) {
      for (const hit of bankVariantMap.get(variant) || []) hits.add(hit);
    }

    if (hits.size > 0) {
      matched.push({ ...entry, matchedWords: [...hits] });
    } else {
      unmatchedWords.push(entry);
    }
  }

  const payload = {
    source: source.source,
    sourcePath: source.sourcePath,
    expectedWordSlots: source.expectedWordSlots,
    extractedWordRows: source.extractedWordRows,
    matchedSourceRows: matched.length,
    unmatchedSourceRows: unmatchedWords.length,
    taggedBankWords: bank.words.filter((word) => word.tags.includes("shanghai-zhongkao")).length,
    missingNumbers: source.missingNumbers || [],
    blankRows: source.blankRows || [],
    duplicateWords: source.duplicateWords || [],
    unmatchedWords
  };

  const csv = [
    "kind,no,raw_word,word,variants",
    ...(payload.missingNumbers || []).map((no) => ["missing-number", no, "", "", ""].map(csvEscape).join(",")),
    ...(payload.blankRows || []).map((no) => ["blank-row", no, "", "", ""].map(csvEscape).join(",")),
    ...unmatchedWords.map((entry) =>
      ["unmatched-word", entry.no, entry.rawWord, entry.word, (entry.variants || []).join(";")]
        .map(csvEscape)
        .join(",")
    )
  ].join("\n");

  await mkdir(outputDir, { recursive: true });
  await writeFile(unmatchedJsonPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  await writeFile(unmatchedCsvPath, `${csv}\n`, "utf8");

  console.log(`Matched source rows: ${payload.matchedSourceRows}`);
  console.log(`Unmatched source rows: ${payload.unmatchedSourceRows}`);
  console.log(`Tagged bank words: ${payload.taggedBankWords}`);
  console.log(`Missing numbers: ${payload.missingNumbers.length}`);
  console.log(`Blank rows: ${payload.blankRows.length}`);
  console.log(`Wrote ${unmatchedJsonPath}`);
  console.log(`Wrote ${unmatchedCsvPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
