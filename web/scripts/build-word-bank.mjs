import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const wordlistRoot = path.join(repoRoot, "middle-school-wordlist");
const dataPath = path.join(wordlistRoot, "data/data.json");
const zhongkaoDataPath = path.join(wordlistRoot, "data/shanghai-zhongkao-vocab.json");
const zhongkaoMatchSummaryPath = path.join(wordlistRoot, "data/shanghai-zhongkao-unmatched.json");
const soundRoot = path.join(wordlistRoot, "sound");
const outputDir = path.resolve(__dirname, "../generated");
const outputPath = path.join(outputDir, "word-bank.json");

const TAGS = [
  { id: "all", label: "全部词汇", systemGenerated: false },
  { id: "shanghai-zhongkao", label: "上海中考考纲", systemGenerated: false },
  { id: "senior-candidate", label: "高考考纲词汇", systemGenerated: true },
  { id: "cet4-candidate", label: "四级候选", systemGenerated: true },
  { id: "cet6-candidate", label: "六级候选", systemGenerated: true },
  { id: "uncategorized", label: "未分类", systemGenerated: true }
];

async function walkFiles(dir, root = dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkFiles(absolute, root)));
    } else if (entry.isFile()) {
      files.push(path.relative(root, absolute));
    }
  }
  return files;
}

function normalizeText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function wordId(name) {
  return `w_${Buffer.from(name).toString("base64url")}`;
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

function autoTags(item, index, zhongkaoWords) {
  const name = normalizeText(item.name);
  const lowered = name.toLowerCase();
  const definitionText = (item.exp || []).map((entry) => entry.ch || "").join(" ");
  const exampleText = (item.eg || []).map((entry) => `${entry.eng || ""} ${entry.chn || ""}`).join(" ");
  const longOrAcademic = lowered.length >= 10 || /tion|sion|ment|ance|ence|ity|ous|ive|al|ize|ise|ology$/.test(lowered);
  const abstractMeaning = /制度|经济|政治|文化|社会|责任|环境|科学|技术|心理|意识|原则|现象|资源|影响/.test(
    `${definitionText} ${exampleText}`
  );

  const tags = new Set(["all"]);
  if ([...wordNameVariants(name)].some((variant) => zhongkaoWords.has(variant))) {
    tags.add("shanghai-zhongkao");
  }
  if (index >= 1500 || longOrAcademic || abstractMeaning) tags.add("senior-candidate");
  if (index >= 2300 || (longOrAcademic && lowered.length >= 9)) tags.add("cet4-candidate");
  if (index >= 3300 || lowered.length >= 13 || /ology|ization|isation|iveness|ability$/.test(lowered)) tags.add("cet6-candidate");
  if (tags.size === 1) tags.add("uncategorized");
  return [...tags];
}

function soundLookupKey(filename) {
  return path.basename(filename, ".mp3").normalize("NFC");
}

async function build() {
  const raw = JSON.parse(await readFile(dataPath, "utf8"));
  if (!Array.isArray(raw.items)) throw new Error(`${dataPath}: expected an items array`);

  const zhongkaoRaw = JSON.parse(await readFile(zhongkaoDataPath, "utf8"));
  if (!Array.isArray(zhongkaoRaw.words)) throw new Error(`${zhongkaoDataPath}: expected a words array`);
  const zhongkaoMatchSummary = await readOptionalJson(zhongkaoMatchSummaryPath);
  const zhongkaoWords = new Set();
  for (const entry of zhongkaoRaw.words) {
    for (const variant of sourceWordVariants(entry)) {
      zhongkaoWords.add(variant);
    }
  }

  const soundFiles = (await walkFiles(soundRoot)).filter((file) => file.toLowerCase().endsWith(".mp3"));
  const soundByName = new Map();
  for (const file of soundFiles) {
    soundByName.set(soundLookupKey(file), file.split(path.sep).join("/"));
  }

  const missingAudio = [];
  const words = raw.items.map((item, index) => {
    const name = normalizeText(item.name);
    const audioPath = soundByName.get(name.normalize("NFC")) || null;
    if (!audioPath) missingAudio.push(name);

    return {
      id: wordId(name),
      sourceId: normalizeText(item.id || name),
      name,
      sortIndex: index + 1,
      definitions: (item.exp || []).map((entry) => ({
        phonetic: normalizeText(entry.pron),
        partOfSpeech: normalizeText(entry.prop),
        meaning: normalizeText(entry.ch)
      })),
      examples: (item.eg || []).map((entry) => ({
        english: normalizeText(entry.eng),
        chinese: normalizeText(entry.chn)
      })),
      similar: (item.sim || []).map((entry) => ({
        id: wordId(normalizeText(entry.name || entry.id)),
        name: normalizeText(entry.name || entry.id)
      })),
      tags: autoTags(item, index, zhongkaoWords),
      audioPath
    };
  });

  const seen = new Set();
  for (const word of words) {
    if (seen.has(word.id)) throw new Error(`Duplicate word id: ${word.id}`);
    seen.add(word.id);
    if (!word.name) throw new Error("Word is missing name");
    if (word.definitions.length === 0) throw new Error(`${word.name}: missing definitions`);
    if (word.examples.length === 0) throw new Error(`${word.name}: missing examples`);
  }

  try {
    await stat(soundRoot);
  } catch {
    throw new Error(`Missing sound directory: ${soundRoot}`);
  }

  const bank = {
    version: 1,
    generatedAt: new Date().toISOString(),
    source: "middle-school-wordlist",
    zhongkao: {
      source: zhongkaoRaw.source || zhongkaoMatchSummary?.source || "上海中考考纲词汇",
      extractedWordRows: zhongkaoRaw.words.length,
      matchedSourceRows: Number(zhongkaoMatchSummary?.matchedSourceRows) || null,
      unmatchedSourceRows: Number(zhongkaoMatchSummary?.unmatchedSourceRows) || null
    },
    totalWords: words.length,
    totalAudioFiles: soundFiles.length,
    missingAudio,
    tags: TAGS.map((tag) => ({
      ...tag,
      count: words.filter((word) => word.tags.includes(tag.id)).length
    })),
    words
  };

  await mkdir(outputDir, { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(bank, null, 2)}\n`, "utf8");
  console.log(`Wrote ${outputPath}`);
  console.log(`Words: ${bank.totalWords}, audio files: ${bank.totalAudioFiles}, missing audio: ${missingAudio.length}`);
  if (bank.zhongkao.matchedSourceRows) {
    const taggedCount = bank.tags.find((tag) => tag.id === "shanghai-zhongkao")?.count || 0;
    console.log(`Shanghai zhongkao matched source rows: ${bank.zhongkao.matchedSourceRows}, tagged bank words: ${taggedCount}`);
  }
}

async function readOptionalJson(file) {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch {
    return null;
  }
}

build().catch((error) => {
  console.error(error);
  process.exit(1);
});
