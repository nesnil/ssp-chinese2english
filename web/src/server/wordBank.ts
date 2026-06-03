import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import type { AppConfig, WordBank, WordEntry, WordTagSummary } from "./types.js";
import type { AppDatabase, WordRow } from "./db.js";

// Static tag label/order table (mirrors build-word-bank.mjs TAGS). Counts are recomputed at runtime.
const TAGS: Array<{ id: string; label: string; systemGenerated: boolean }> = [
  { id: "all", label: "全部词汇", systemGenerated: false },
  { id: "shanghai-zhongkao", label: "上海中考考纲", systemGenerated: false },
  { id: "junior-candidate", label: "初中候选", systemGenerated: true },
  { id: "senior-candidate", label: "高中候选", systemGenerated: true },
  { id: "cet4-candidate", label: "四级候选", systemGenerated: true },
  { id: "cet6-candidate", label: "六级候选", systemGenerated: true },
  { id: "uncategorized", label: "未分类", systemGenerated: true }
];

let database: AppDatabase | null = null;
let appConfig: AppConfig | null = null;
let bank: WordBank = emptyBank();
let wordsById = new Map<string, WordEntry>();

export function loadSeedWordBank(): WordBank {
  const bankPath = process.env.WORD_BANK_PATH || path.resolve(process.cwd(), "generated/word-bank.json");
  return JSON.parse(readFileSync(bankPath, "utf8")) as WordBank;
}

export function initWordBank(db: AppDatabase, config: AppConfig): void {
  database = db;
  appConfig = config;
  reloadWordBank();
}

export function reloadWordBank(): void {
  if (!database) throw new Error("Word bank not initialized.");
  const rows = database.allWordRows();
  const words = rows.map(rowToWord);
  wordsById = new Map(words.map((word) => [word.id, word]));
  bank = buildSummary(words, database);
}

export function getWordBank(): WordBank {
  return bank;
}

export function getWord(id: string): WordEntry | undefined {
  return wordsById.get(id);
}

export function getWordsByTag(tagId = "all"): WordEntry[] {
  if (tagId === "all") return bank.words;
  return bank.words.filter((word) => word.tags.includes(tagId));
}

export function toPublicWordPrompt(word: WordEntry, itemNo: number) {
  return {
    id: word.id,
    itemNo,
    partsOfSpeech: uniquePartsOfSpeech(word)
  };
}

export function toPublicWordDetails(word: WordEntry) {
  const example = word.examples[0] || { english: "", chinese: "" };
  return {
    id: word.id,
    name: word.name,
    phonetics: [...new Set(word.definitions.map((definition) => definition.phonetic).filter(Boolean))],
    definitions: word.definitions,
    example,
    tags: word.tags,
    hasAudio: Boolean(word.audioPath)
  };
}

export function uniquePartsOfSpeech(word: WordEntry): string[] {
  const parts = [...new Set(word.definitions.map((definition) => definition.partOfSpeech).filter(Boolean))];
  return parts.length ? parts : ["释义"];
}

export function resolveWordAudioPath(config: AppConfig, word: WordEntry): string | null {
  if (!word.audioPath) return null;
  const root = resolveAudioRoot(config);
  const absolute = path.resolve(root, word.audioPath);
  if (!absolute.startsWith(path.resolve(root))) return null;
  return absolute;
}

// Re-derive the relative audio path for a (possibly renamed) word by matching the
// NFC-normalized name against the on-disk sound directory, mirroring build-word-bank.mjs.
export function resolveAudioPathByName(config: AppConfig, name: string): string | null {
  const root = resolveAudioRoot(config);
  if (!existsSync(root)) return null;
  const target = name.normalize("NFC");
  for (const file of listMp3Files(root, root)) {
    if (path.basename(file, ".mp3").normalize("NFC") === target) {
      return file.split(path.sep).join("/");
    }
  }
  return null;
}

function resolveAudioRoot(config: AppConfig): string {
  if (config.wordAudioRoot) return config.wordAudioRoot;

  const candidates = [
    path.resolve(process.cwd(), "../middle-school-wordlist/sound"),
    path.resolve(process.cwd(), "middle-school-wordlist/sound"),
    "/app/middle-school-wordlist/sound"
  ];

  return candidates.find((candidate) => existsSync(candidate)) || candidates[0];
}

function listMp3Files(dir: string, root: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listMp3Files(absolute, root));
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".mp3")) {
      files.push(path.relative(root, absolute));
    }
  }
  return files;
}

function buildSummary(words: WordEntry[], db: AppDatabase): WordBank {
  const matchedSourceRows = numberOrNull(db.getReferenceMeta("zhongkao.matchedSourceRows"));
  const tags: WordTagSummary[] = TAGS.map((tag) => ({
    ...tag,
    count: tag.id === "all" ? words.length : words.filter((word) => word.tags.includes(tag.id)).length
  }));

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    source: db.getReferenceMeta("word.source") || "middle-school-wordlist",
    zhongkao: {
      source: db.getReferenceMeta("zhongkao.source") || "上海中考考纲词汇",
      extractedWordRows: numberOrNull(db.getReferenceMeta("zhongkao.extractedWordRows")) || 0,
      matchedSourceRows,
      unmatchedSourceRows: numberOrNull(db.getReferenceMeta("zhongkao.unmatchedSourceRows"))
    },
    totalWords: words.length,
    totalAudioFiles: numberOrNull(db.getReferenceMeta("word.totalAudioFiles")) || words.filter((w) => w.audioPath).length,
    missingAudio: words.filter((word) => !word.audioPath).map((word) => word.name),
    tags,
    words
  };
}

function rowToWord(row: WordRow): WordEntry {
  return {
    id: row.id,
    sourceId: row.source_id,
    name: row.name,
    sortIndex: row.sort_index,
    definitions: parseJsonArray(row.definitions_json),
    examples: parseJsonArray(row.examples_json),
    similar: parseJsonArray(row.similar_json),
    tags: parseStringArray(row.tags_json),
    audioPath: row.audio_path
  };
}

function parseJsonArray<T>(raw: string): T[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function parseStringArray(raw: string): string[] {
  return parseJsonArray<unknown>(raw)
    .map((value) => String(value))
    .filter(Boolean);
}

function numberOrNull(raw: string | null): number | null {
  if (raw === null || raw === "") return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function emptyBank(): WordBank {
  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    source: "middle-school-wordlist",
    totalWords: 0,
    totalAudioFiles: 0,
    missingAudio: [],
    tags: TAGS.map((tag) => ({ ...tag, count: 0 })),
    words: []
  };
}
