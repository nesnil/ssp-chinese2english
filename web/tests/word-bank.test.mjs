import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const bank = JSON.parse(await readFile(new URL("../generated/word-bank.json", import.meta.url), "utf8"));

test("word bank is generated from the middle-school wordlist", () => {
  assert.equal(bank.totalWords, 4237);
  assert.ok(bank.totalAudioFiles >= 4237);
  assert.ok(Array.isArray(bank.words));
  assert.ok(Array.isArray(bank.tags));
});

test("word entries expose practice-safe fields and audio mapping", () => {
  const ability = bank.words.find((word) => word.name === "ability");
  assert.ok(ability);
  assert.match(ability.id, /^w_/);
  assert.equal(ability.definitions[0].partOfSpeech, "n.");
  assert.match(ability.definitions[0].meaning, /能力/);
  assert.ok(ability.examples[0].english);
  assert.ok(ability.examples[0].chinese);
  assert.equal(ability.audioPath, "a/ability.mp3");
  assert.ok(ability.tags.includes("all"));
  assert.ok(ability.tags.includes("shanghai-zhongkao"));
});

test("known missing audio entries are recorded but do not block the bank", () => {
  assert.ok(bank.missingAudio.includes("salesman/saleswoman"));
});

test("Shanghai zhongkao vocabulary tag is populated from the source list", () => {
  const tag = bank.tags.find((item) => item.id === "shanghai-zhongkao");
  assert.ok(tag);
  assert.equal(tag.label, "上海中考考纲");
  assert.equal(bank.zhongkao.matchedSourceRows, 1650);
  assert.equal(tag.count, 1658);
  assert.equal(bank.words.filter((word) => word.tags.includes("shanghai-zhongkao")).length, tag.count);
});

test("senior vocabulary tag is labeled as gaokao vocabulary", () => {
  const tag = bank.tags.find((item) => item.id === "senior-candidate");
  assert.ok(tag);
  assert.equal(tag.label, "高考考纲词汇");
});
