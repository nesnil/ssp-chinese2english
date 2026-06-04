import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { AppDatabase } from "../dist/server/db.js";

const tempRoot = await mkdtemp(path.join(os.tmpdir(), "c2e-word-test-"));

function makeDatabase() {
  return new AppDatabase({
    port: 3000,
    databasePath: path.join(tempRoot, `${randomUUID()}.sqlite`),
    aiTimeoutMs: 30000,
    reviewScoreThreshold: 80,
    nodeEnv: "test"
  });
}

function word(id, name = id) {
  return {
    id,
    sourceId: name,
    name,
    sortIndex: 1,
    definitions: [{ phonetic: "", partOfSpeech: "n.", meaning: "测试" }],
    examples: [{ english: "This is a test.", chinese: "这是一个测试。" }],
    similar: [],
    tags: ["all"],
    audioPath: null
  };
}

function grade(score) {
  return {
    score,
    level: score >= 80 ? "不错" : "继续加油",
    encouragement: "继续保持。",
    issues: score >= 80 ? [] : ["需要再检查。"],
    suggestion: "检查拼写和意思。",
    improvedAnswer: "Reference.",
    referenceAnswer: "Reference.",
    needsReview: score < 80
  };
}

function submit(database, { sessionId = null, wordId, phase, score }) {
  database.saveWordSubmission({
    sessionId,
    wordId,
    phase,
    wordAnswer: phase === "word" ? wordId : null,
    meaningAnswers: phase === "word" ? { "n.": "测试" } : {},
    answer: "student answer",
    grade: grade(score)
  });
}

test("word batch size defaults to 5 and is clamped", () => {
  const database = makeDatabase();
  assert.equal(database.getWordBatchSize(), 5);
  assert.equal(database.setWordBatchSize(0), 1);
  assert.equal(database.getWordBatchSize(), 1);
  assert.equal(database.setWordBatchSize(99), 30);
});

test("a word is mastered only after word and example phases pass", () => {
  const database = makeDatabase();
  const session = database.startWordSession([word("ability")], "all", "new");
  submit(database, { sessionId: session.sessionId, wordId: "ability", phase: "word", score: 86 });

  assert.deepEqual([...database.masteredWordIds(80)], []);
  assert.equal(database.completeWordSessionIfReady(session.sessionId, 80), false);

  submit(database, { sessionId: session.sessionId, wordId: "ability", phase: "example", score: 82 });

  assert.deepEqual([...database.masteredWordIds(80)], ["ability"]);
  assert.equal(database.completeWordSessionIfReady(session.sessionId, 80), true);
});

test("low word or example scores enter the independent word review queue", () => {
  const database = makeDatabase();
  submit(database, { wordId: "abandon", phase: "word", score: 60 });
  submit(database, { wordId: "ability", phase: "word", score: 90 });
  submit(database, { wordId: "ability", phase: "example", score: 70 });

  assert.deepEqual(
    database.latestWordReviewRows(80).map((row) => `${row.word_id}:${row.latest_phase}`),
    ["abandon:word", "ability:example"]
  );

  submit(database, { wordId: "abandon", phase: "word", score: 85 });
  submit(database, { wordId: "abandon", phase: "example", score: 88 });

  assert.deepEqual(
    database.latestWordReviewRows(80).map((row) => `${row.word_id}:${row.latest_phase}`),
    ["ability:example"]
  );
});

test("word progress is separate from sentence submissions", () => {
  const database = makeDatabase();
  submit(database, { wordId: "ability", phase: "word", score: 90 });
  submit(database, { wordId: "ability", phase: "example", score: 92 });

  const progress = database.getWordProgress(4237, 80);
  assert.equal(progress.totalWords, 4237);
  assert.equal(progress.practicedWords, 1);
  assert.equal(progress.masteredWords, 1);
  assert.equal(progress.reviewWords, 0);
  assert.equal(progress.submissionCount, 2);
});

test("word progress can be scoped to a configured vocabulary list", () => {
  const database = makeDatabase();
  submit(database, { wordId: "ability", phase: "word", score: 90 });
  submit(database, { wordId: "ability", phase: "example", score: 92 });
  submit(database, { wordId: "abandon", phase: "word", score: 40 });

  const progress = database.getWordProgress(1, 80, ["ability"]);
  assert.equal(progress.totalWords, 1);
  assert.equal(progress.practicedWords, 1);
  assert.equal(progress.masteredWords, 1);
  assert.equal(progress.reviewWords, 0);
  assert.equal(progress.submissionCount, 2);
});

test("unfinished word level sessions resume at the next incomplete phase", () => {
  const database = makeDatabase();
  const words = [word("ability"), word("able")];
  const first = database.startOrResumeWordSession(words, "shanghai-zhongkao", "level", "a-1", 80);
  submit(database, { sessionId: first.sessionId, wordId: "ability", phase: "word", score: 90 });

  const resumeExample = database.startOrResumeWordSession(words, "shanghai-zhongkao", "level", "a-1", 80);
  assert.equal(resumeExample.sessionId, first.sessionId);
  assert.equal(resumeExample.resumed, true);
  assert.deepEqual(
    { itemNo: resumeExample.resume.itemNo, phase: resumeExample.resume.phase, score: resumeExample.resume.wordGrade.score },
    { itemNo: 1, phase: "example", score: 90 }
  );

  submit(database, { sessionId: first.sessionId, wordId: "ability", phase: "example", score: 92 });

  const resumeNextWord = database.startOrResumeWordSession(words, "shanghai-zhongkao", "level", "a-1", 80);
  assert.equal(resumeNextWord.sessionId, first.sessionId);
  assert.deepEqual(
    { itemNo: resumeNextWord.resume.itemNo, phase: resumeNextWord.resume.phase },
    { itemNo: 2, phase: "word" }
  );
});
