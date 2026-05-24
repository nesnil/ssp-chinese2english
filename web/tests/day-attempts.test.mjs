import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { AppDatabase } from "../dist/server/db.js";

const tempRoot = await mkdtemp(path.join(os.tmpdir(), "c2e-attempt-test-"));

function makeDatabase() {
  return new AppDatabase({
    port: 3000,
    databasePath: path.join(tempRoot, `${randomUUID()}.sqlite`),
    aiTimeoutMs: 30000,
    reviewScoreThreshold: 80,
    nodeEnv: "test"
  });
}

function grade(score) {
  return {
    score,
    level: score >= 80 ? "不错" : "继续加油",
    encouragement: "继续保持。",
    issues: [],
    suggestion: "检查提示词。",
    improvedAnswer: "Improved answer.",
    referenceAnswer: "Reference answer.",
    needsReview: score < 80
  };
}

function submit(database, { attemptId = null, mode = "day", season = 1, day = 1, questionNo, score }) {
  database.saveSubmission({
    questionId: `S${season}-D${day}-Q${questionNo}`,
    season,
    day,
    questionNo,
    answer: "student answer",
    grade: grade(score),
    attemptId,
    mode
  });
  if (attemptId) database.completeDayAttemptIfReady(attemptId);
}

test("a day attempt completes only after every question is submitted", () => {
  const database = makeDatabase();
  const attemptId = database.startDayAttempt(1, 1, 3);

  submit(database, { attemptId, questionNo: 1, score: 90 });
  submit(database, { attemptId, questionNo: 2, score: 80 });
  assert.equal(database.getDayAttemptStats().get("1:1"), undefined);

  submit(database, { attemptId, questionNo: 3, score: 70 });
  const stats = database.getDayAttemptStats().get("1:1");
  assert.equal(stats.attemptCount, 1);
  assert.equal(stats.latestAverageScore, 80);
});

test("a second completed day attempt updates latest score and count", () => {
  const database = makeDatabase();
  const firstAttempt = database.startDayAttempt(1, 1, 2);
  submit(database, { attemptId: firstAttempt, questionNo: 1, score: 70 });
  submit(database, { attemptId: firstAttempt, questionNo: 2, score: 80 });

  const secondAttempt = database.startDayAttempt(1, 1, 2);
  submit(database, { attemptId: secondAttempt, questionNo: 1, score: 90 });
  submit(database, { attemptId: secondAttempt, questionNo: 2, score: 100 });

  const stats = database.getDayAttemptStats().get("1:1");
  assert.equal(stats.attemptCount, 2);
  assert.equal(stats.latestAverageScore, 95);
});

test("overall completed day average uses each day's latest completed score", () => {
  const database = makeDatabase();
  const firstDayAttempt = database.startDayAttempt(1, 1, 1);
  submit(database, { attemptId: firstDayAttempt, day: 1, questionNo: 1, score: 60 });
  const secondFirstDayAttempt = database.startDayAttempt(1, 1, 1);
  submit(database, { attemptId: secondFirstDayAttempt, day: 1, questionNo: 1, score: 80 });
  const secondDayAttempt = database.startDayAttempt(1, 2, 1);
  submit(database, { attemptId: secondDayAttempt, day: 2, questionNo: 1, score: 100 });

  assert.equal(database.getCompletedDayAverageScore(), 90);
});

test("review submissions do not affect day attempt stats", () => {
  const database = makeDatabase();
  const attemptId = database.startDayAttempt(1, 1, 1);
  submit(database, { attemptId, questionNo: 1, score: 88 });
  submit(database, { mode: "review", questionNo: 1, score: 40 });

  const stats = database.getDayAttemptStats().get("1:1");
  assert.equal(stats.attemptCount, 1);
  assert.equal(stats.latestAverageScore, 88);
});

test("legacy completed day submissions are backfilled as one completed attempt", () => {
  const database = makeDatabase();
  submit(database, { questionNo: 1, score: 80 });
  submit(database, { questionNo: 2, score: 90 });
  submit(database, { questionNo: 3, score: 100 });

  database.backfillLegacyDayAttempts(new Map([["1:1", 3]]));
  const stats = database.getDayAttemptStats().get("1:1");
  assert.equal(stats.attemptCount, 1);
  assert.equal(stats.latestAverageScore, 90);

  database.backfillLegacyDayAttempts(new Map([["1:1", 3]]));
  assert.equal(database.getDayAttemptStats().get("1:1").attemptCount, 1);
});
