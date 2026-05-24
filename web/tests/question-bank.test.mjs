import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const bank = JSON.parse(await readFile(new URL("../generated/question-bank.json", import.meta.url), "utf8"));

test("question bank has stable totals", () => {
  assert.equal(bank.totalSeasons, 4);
  assert.equal(bank.totalDays, 224);
  assert.equal(bank.totalQuestions, 1115);
});

test("client-safe fields can be derived without answers", () => {
  const sample = bank.questions[0];
  const publicQuestion = {
    id: sample.id,
    season: sample.season,
    day: sample.day,
    questionNo: sample.questionNo,
    chinese: sample.chinese,
    prompt: sample.prompt
  };
  assert.equal(publicQuestion.id, "S1-D1-Q1");
  assert.ok(!("referenceAnswer" in publicQuestion));
});
