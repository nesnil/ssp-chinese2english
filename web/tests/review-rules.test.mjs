import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { AppDatabase, computeDayProgress } from "../dist/server/db.js";

function makeDatabase() {
  return new AppDatabase({
    port: 3000,
    databasePath: path.join(tempRoot, `${randomUUID()}.sqlite`),
    aiTimeoutMs: 30000,
    reviewScoreThreshold: 80,
    nodeEnv: "test"
  });
}

function insertSubmission(database, { questionId, season = 1, day = 1, questionNo = 1, score, mode = "day", issues = ["需要再检查句子结构"] }) {
  database.db
    .prepare(`
      INSERT INTO submissions (
        question_id, season, day, question_no, answer, score, level, encouragement,
        issues_json, suggestion, improved_answer, reference_answer, needs_review, mode
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .run(
      questionId,
      season,
      day,
      questionNo,
      "student answer",
      score,
      score >= 80 ? "不错" : "继续加油",
      "继续努力。",
      JSON.stringify(issues),
      "检查提示词。",
      "Improved answer.",
      "Reference answer.",
      score < 80 ? 1 : 0,
      mode
    );
}

const tempRoot = await mkdtemp(path.join(os.tmpdir(), "c2e-review-test-"));

test("latest review submissions include only latest scores below threshold", () => {
  const database = makeDatabase();
  insertSubmission(database, { questionId: "S1-D1-Q1", score: 79 });
  insertSubmission(database, { questionId: "S1-D1-Q2", questionNo: 2, score: 70 });

  assert.deepEqual(
    database.latestReviewSubmissions(80).map((row) => row.question_id),
    ["S1-D1-Q2", "S1-D1-Q1"]
  );

  insertSubmission(database, { questionId: "S1-D1-Q1", score: 80 });

  assert.deepEqual(
    database.latestReviewSubmissions(80).map((row) => row.question_id),
    ["S1-D1-Q2"]
  );
});

test("day progress review flag is based on latest score threshold", () => {
  const rows = [
    { question_id: "S1-D1-Q1", season: 1, day: 1, question_no: 1, score: 79, needs_review: 1, created_at: "" },
    { question_id: "S1-D1-Q2", season: 1, day: 1, question_no: 2, score: 91, needs_review: 0, created_at: "" },
    { question_id: "S1-D2-Q1", season: 1, day: 2, question_no: 1, score: 88, needs_review: 0, created_at: "" }
  ];
  const progress = computeDayProgress(
    rows,
    new Map([
      ["1:1", 2],
      ["1:2", 1]
    ]),
    80
  );

  assert.equal(progress.get("1:1").needsReview, true);
  assert.equal(progress.get("1:2").needsReview, false);
});

test("review stats count distinct reviewed questions, submissions, and mastered questions", () => {
  const database = makeDatabase();
  insertSubmission(database, { questionId: "S1-D1-Q1", score: 70, mode: "review" });
  insertSubmission(database, { questionId: "S1-D1-Q1", score: 78, mode: "review" });
  insertSubmission(database, { questionId: "S1-D1-Q2", questionNo: 2, score: 60, mode: "review" });
  insertSubmission(database, { questionId: "S1-D1-Q2", questionNo: 2, score: 85, mode: "review" });
  insertSubmission(database, { questionId: "S1-D1-Q3", questionNo: 3, score: 95, mode: "day" });

  const stats = database.getReviewStats(80);
  assert.equal(stats.reviewedQuestionCount, 2);
  assert.equal(stats.reviewSubmissionCount, 4);
  assert.equal(stats.reviewMasteredQuestionCount, 1);
  assert.equal(stats.currentReviewCount, 1);
  assert.deepEqual(
    database.latestReviewSubmissions(80).map((row) => row.question_id),
    ["S1-D1-Q1"]
  );
});

test("review history groups questions by latest review time and returns recent records", () => {
  const database = makeDatabase();
  insertSubmission(database, { questionId: "S1-D1-Q1", score: 70, mode: "review" });
  insertSubmission(database, { questionId: "S1-D1-Q2", questionNo: 2, score: 90, mode: "review" });
  insertSubmission(database, { questionId: "S1-D1-Q1", score: 82, mode: "review" });

  const history = database.reviewHistory(2);
  assert.deepEqual(
    history.attempts.map((row) => `${row.question_id}:${row.score}`),
    ["S1-D1-Q1:70", "S1-D1-Q2:90", "S1-D1-Q1:82"]
  );
  assert.deepEqual(
    history.questions.map((row) => row.question_id),
    ["S1-D1-Q1", "S1-D1-Q2"]
  );
  assert.equal(history.questions[0].review_count, 2);
  assert.equal(history.questions[0].best_score, 82);
  assert.deepEqual(
    history.records.map((row) => row.question_id),
    ["S1-D1-Q1", "S1-D1-Q2"]
  );
});

test("review history exposes latest review score separately from current score", () => {
  const database = makeDatabase();
  insertSubmission(database, { questionId: "S4-D1-Q1", season: 4, day: 1, score: 100, mode: "review" });
  insertSubmission(database, { questionId: "S4-D1-Q1", season: 4, day: 1, score: 0, mode: "day" });

  const [question] = database.reviewHistory().questions;
  assert.equal(question.latest_score, 100);
  assert.equal(question.current_score, 0);
});

test("review history can show a latest review score below the best score", () => {
  const database = makeDatabase();
  insertSubmission(database, { questionId: "S4-D1-Q2", season: 4, day: 1, questionNo: 2, score: 98, mode: "review" });
  insertSubmission(database, { questionId: "S4-D1-Q2", season: 4, day: 1, questionNo: 2, score: 50, mode: "review" });

  const [question] = database.reviewHistory().questions;
  assert.equal(question.best_score, 98);
  assert.equal(question.latest_score, 50);
});
