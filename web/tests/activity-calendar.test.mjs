import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { AppDatabase } from "../dist/server/db.js";

const tempRoot = await mkdtemp(path.join(os.tmpdir(), "c2e-activity-calendar-test-"));

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
    issues: score >= 80 ? [] : ["需要再检查。"],
    suggestion: "检查拼写和意思。",
    improvedAnswer: "Reference.",
    referenceAnswer: "Reference.",
    needsReview: score < 80
  };
}

function submitSentenceAt(database, { questionId, score, createdAt, season = 1, day = 1, questionNo = 1 }) {
  const id = database.saveSubmission({
    questionId,
    season,
    day,
    questionNo,
    answer: "student answer",
    grade: grade(score),
    attemptId: null,
    mode: "day"
  });
  database.db.prepare("UPDATE submissions SET created_at = ? WHERE id = ?").run(createdAt, id);
  return id;
}

function submitWordAt(database, { wordId, score, createdAt, phase = "word", practiceKind = "junior" }) {
  const id = database.saveWordSubmission({
    sessionId: null,
    practiceKind,
    wordId,
    phase,
    wordAnswer: wordId,
    meaningAnswers: {},
    answer: "student answer",
    grade: grade(score)
  });
  database.db.prepare("UPDATE word_submissions SET created_at = ? WHERE id = ?").run(createdAt, id);
  return id;
}

function insertCompletedSentenceDay(database, { season, day, questionCount, score, completedAt }) {
  database.db
    .prepare(
      "INSERT INTO day_attempts (season, day, question_count, status, average_score, completed_at) VALUES (?, ?, ?, 'completed', ?, ?)"
    )
    .run(season, day, questionCount, score, completedAt);
}

function insertCompletedWordSession(database, { wordCount, score, completedAt, mode = "level", levelId = "a-1", practiceKind = "junior" }) {
  database.db
    .prepare(
      "INSERT INTO word_sessions (practice_kind, scope_tag, mode, level_id, word_count, status, average_score, completed_at) VALUES (?, ?, ?, ?, ?, 'completed', ?, ?)"
    )
    .run(practiceKind, practiceKind === "senior" ? "senior-candidate" : "shanghai-zhongkao", mode, levelId, wordCount, score, completedAt);
}

function day(calendar, date) {
  return calendar.days.find((item) => item.date === date);
}

test("activity calendar groups UTC SQLite timestamps by Shanghai date", () => {
  const database = makeDatabase();
  submitSentenceAt(database, {
    questionId: "S1-D1-Q1",
    score: 90,
    createdAt: "2026-01-01 16:30:00"
  });

  const calendar = database.getActivityCalendar(2026, "2026-01-02");
  assert.equal(day(calendar, "2026-01-01").completed, false);
  assert.equal(day(calendar, "2026-01-02").completed, true);
  assert.equal(day(calendar, "2026-01-02").sentence.status, "partial");
  assert.equal(day(calendar, "2026-01-02").sentence.time, "00:30");
  assert.equal(calendar.summary.currentStreak, 1);
});

test("activity calendar reports completed, partial and missing practice states", () => {
  const database = makeDatabase();
  insertCompletedSentenceDay(database, {
    season: 1,
    day: 5,
    questionCount: 5,
    score: 92,
    completedAt: "2026-01-05 12:00:00"
  });
  insertCompletedWordSession(database, {
    wordCount: 5,
    score: 88,
    completedAt: "2026-01-05 12:30:00"
  });

  submitSentenceAt(database, {
    questionId: "S1-D6-Q1",
    season: 1,
    day: 6,
    questionNo: 1,
    score: 70,
    createdAt: "2026-01-06 11:00:00"
  });
  submitSentenceAt(database, {
    questionId: "S1-D6-Q2",
    season: 1,
    day: 6,
    questionNo: 2,
    score: 80,
    createdAt: "2026-01-06 11:10:00"
  });
  submitWordAt(database, {
    wordId: "ability",
    score: 83,
    createdAt: "2026-01-07 10:00:00"
  });

  const calendar = database.getActivityCalendar(2026, "2026-01-07");
  const jan5 = day(calendar, "2026-01-05");
  assert.equal(jan5.sentence.status, "complete");
  assert.equal(jan5.sentence.score, 92);
  assert.equal(jan5.word.status, "complete");
  assert.equal(jan5.word.label, "中考词汇练习完成");
  assert.equal(jan5.juniorWord.status, "complete");
  assert.equal(jan5.juniorWord.label, "中考词汇练习完成");
  assert.equal(jan5.seniorWord.status, "none");
  assert.equal(jan5.word.score, 88);
  assert.equal(jan5.events.length, 2);
  assert.equal(jan5.events[1].label, "中考词汇练习");

  const jan6 = day(calendar, "2026-01-06");
  assert.equal(jan6.sentence.status, "partial");
  assert.equal(jan6.sentence.count, 2);
  assert.equal(jan6.sentence.score, 75);
  assert.equal(jan6.word.status, "none");
  assert.equal(jan6.word.label, "单词未练");
  assert.equal(jan6.juniorWord.label, "中考词汇未练");
  assert.equal(jan6.seniorWord.label, "高考词汇未练");

  const jan7 = day(calendar, "2026-01-07");
  assert.equal(jan7.sentence.status, "none");
  assert.equal(jan7.word.status, "partial");
  assert.equal(jan7.juniorWord.status, "partial");
  assert.equal(jan7.seniorWord.status, "none");
  assert.equal(jan7.word.count, 1);
  assert.equal(calendar.summary.currentStreak, 3);
  assert.equal(calendar.summary.longestStreak, 3);
  assert.equal(calendar.summary.completedDays, 3);
});

test("activity calendar labels senior word practice separately", () => {
  const database = makeDatabase();
  insertCompletedWordSession(database, {
    practiceKind: "senior",
    wordCount: 10,
    score: 91,
    completedAt: "2026-01-08 12:30:00",
    levelId: "a-1"
  });
  submitWordAt(database, {
    practiceKind: "senior",
    wordId: "academic",
    score: 85,
    createdAt: "2026-01-09 10:00:00"
  });

  const calendar = database.getActivityCalendar(2026, "2026-01-09");
  const jan8 = day(calendar, "2026-01-08");
  assert.equal(jan8.word.label, "高考词汇练习完成");
  assert.equal(jan8.seniorWord.label, "高考词汇练习完成");
  assert.equal(jan8.juniorWord.status, "none");
  assert.equal(jan8.events[0].label, "高考词汇练习");
  assert.equal(jan8.events[0].practiceKind, "senior");

  const jan9 = day(calendar, "2026-01-09");
  assert.equal(jan9.word.label, "高考词汇练习 1 个");
  assert.equal(jan9.seniorWord.label, "高考词汇练习 1 个");
  assert.equal(jan9.events[0].label, "高考词汇练习");
});

test("activity calendar keeps junior and senior word practice separate on the same day", () => {
  const database = makeDatabase();
  insertCompletedWordSession(database, {
    practiceKind: "junior",
    wordCount: 5,
    score: 88,
    completedAt: "2026-01-10 10:00:00",
    levelId: "a-1"
  });
  insertCompletedWordSession(database, {
    practiceKind: "senior",
    wordCount: 10,
    score: 94,
    completedAt: "2026-01-10 11:00:00",
    levelId: "b-2"
  });

  const calendar = database.getActivityCalendar(2026, "2026-01-10");
  const jan10 = day(calendar, "2026-01-10");
  assert.equal(jan10.completed, true);
  assert.equal(jan10.juniorWord.status, "complete");
  assert.equal(jan10.juniorWord.score, 88);
  assert.equal(jan10.seniorWord.status, "complete");
  assert.equal(jan10.seniorWord.score, 94);
  assert.equal(jan10.word.label, "词汇完成 2 项");
  assert.equal(jan10.word.score, 91);
  assert.deepEqual(
    jan10.events.map((event) => `${event.practiceKind}:${event.label}:${event.score}`),
    ["junior:中考词汇练习:88", "senior:高考词汇练习:94"]
  );
});
