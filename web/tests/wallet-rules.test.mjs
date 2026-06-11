import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { AppDatabase } from "../dist/server/db.js";

const tempRoot = await mkdtemp(path.join(os.tmpdir(), "c2e-wallet-test-"));

function makeDatabase() {
  return new AppDatabase({
    port: 3000,
    databasePath: path.join(tempRoot, `${randomUUID()}.sqlite`),
    aiTimeoutMs: 30000,
    reviewScoreThreshold: 80,
    nodeEnv: "test"
  });
}

// 奖/罚区间收成定值,让金额可断言。
function makeDeterministicDatabase() {
  const database = makeDatabase();
  database.updateWalletSettings({
    rewardMinCents: 200,
    rewardMaxCents: 200,
    penaltyMinCents: 100,
    penaltyMaxCents: 100
  });
  return database;
}

function grade(score, errorSummary) {
  return {
    score,
    level: score >= 80 ? "不错" : "继续加油",
    encouragement: "继续保持。",
    issues: score >= 80 ? [] : ["需要再检查。"],
    suggestion: "检查拼写和意思。",
    improvedAnswer: "Reference.",
    referenceAnswer: "Reference.",
    needsReview: score < 80,
    errorSummary
  };
}

function submitSentence(database, { questionId, score, errorSummary, mode = "day" }) {
  const submissionId = database.saveSubmission({
    questionId,
    season: 1,
    day: 1,
    questionNo: 1,
    answer: "student answer",
    grade: grade(score, errorSummary),
    attemptId: null,
    mode
  });
  return database.settleSubmissionWallet({ source: "sentence", questionId, submissionId, score, errorSummary });
}

function submitWord(database, { wordId, phase, score, errorSummary }) {
  const submissionId = database.saveWordSubmission({
    sessionId: null,
    wordId,
    phase,
    wordAnswer: phase === "word" ? wordId : null,
    meaningAnswers: {},
    answer: "student answer",
    grade: grade(score, errorSummary)
  });
  return database.settleSubmissionWallet({ source: "word", wordId, phase, submissionId, score, errorSummary });
}

test("wallet settings default to 1~3 yuan reward, 1~2 yuan penalty, 10 yuan threshold", () => {
  const database = makeDatabase();
  const settings = database.getWalletSettings();
  assert.deepEqual(
    {
      rewardMinCents: settings.rewardMinCents,
      rewardMaxCents: settings.rewardMaxCents,
      penaltyMinCents: settings.penaltyMinCents,
      penaltyMaxCents: settings.penaltyMaxCents,
      withdrawThresholdCents: settings.withdrawThresholdCents
    },
    { rewardMinCents: 100, rewardMaxCents: 300, penaltyMinCents: 100, penaltyMaxCents: 200, withdrawThresholdCents: 1000 }
  );
});

test("default reward amount is a whole-yuan value within the configured range", () => {
  const database = makeDatabase();
  const result = submitSentence(database, { questionId: "S1-D1-Q1", score: 100 });
  assert.equal(result.reason, "perfect");
  assert.ok(result.change >= 100 && result.change <= 300);
  assert.equal(result.change % 100, 0);
});

test("a perfect score rewards only once per question, including review retakes", () => {
  const database = makeDeterministicDatabase();
  const first = submitSentence(database, { questionId: "S1-D1-Q1", score: 100 });
  assert.deepEqual({ change: first.change, reason: first.reason }, { change: 200, reason: "perfect" });

  const again = submitSentence(database, { questionId: "S1-D1-Q1", score: 100, mode: "review" });
  assert.deepEqual({ change: again.change, reason: again.reason }, { change: 0, reason: null });

  const other = submitSentence(database, { questionId: "S1-D1-Q2", score: 100 });
  assert.equal(other.change, 200);
  assert.equal(database.getWalletBalance(), 400);
});

test("word rewards are tracked per word and phase", () => {
  const database = makeDeterministicDatabase();
  assert.equal(submitWord(database, { wordId: "ability", phase: "word", score: 100 }).change, 200);
  assert.equal(submitWord(database, { wordId: "ability", phase: "example", score: 100 }).change, 200);
  assert.equal(submitWord(database, { wordId: "ability", phase: "word", score: 100 }).change, 0);
  assert.equal(submitWord(database, { wordId: "ability", phase: "example", score: 100 }).change, 0);
  assert.equal(database.getWalletBalance(), 400);
});

test("a failing score penalizes only on the first-ever submission", () => {
  const database = makeDeterministicDatabase();
  const first = submitSentence(database, { questionId: "S1-D1-Q1", score: 50 });
  assert.deepEqual({ change: first.change, reason: first.reason }, { change: -100, reason: "fail" });

  const retry = submitSentence(database, { questionId: "S1-D1-Q1", score: 40 });
  assert.deepEqual({ change: retry.change, reason: retry.reason }, { change: 0, reason: null });
  assert.equal(database.getWalletBalance(), -100);
});

test("a failing retry after a passing first submission is not penalized", () => {
  const database = makeDeterministicDatabase();
  assert.equal(submitSentence(database, { questionId: "S1-D1-Q1", score: 75 }).change, 0);
  assert.equal(submitSentence(database, { questionId: "S1-D1-Q1", score: 50 }).change, 0);
  assert.equal(database.getWalletBalance(), 0);
});

test("scores between 60 and 99 never move the wallet", () => {
  const database = makeDeterministicDatabase();
  assert.equal(submitSentence(database, { questionId: "S1-D1-Q1", score: 60 }).change, 0);
  assert.equal(submitSentence(database, { questionId: "S1-D1-Q2", score: 99 }).change, 0);
  assert.equal(database.getWalletBalance(), 0);
});

test("AI grading failures neither reward nor penalize, nor consume the first-submission slot", () => {
  const database = makeDeterministicDatabase();
  const failed = submitSentence(database, { questionId: "S1-D1-Q1", score: 0, errorSummary: "AI 超时" });
  assert.deepEqual({ change: failed.change, reason: failed.reason }, { change: 0, reason: null });
  assert.equal(database.getWalletBalance(), 0);

  // 评分失败那次不算"首次提交",之后第一次有效提交低分仍然扣钱。
  const firstGraded = submitSentence(database, { questionId: "S1-D1-Q1", score: 50 });
  assert.deepEqual({ change: firstGraded.change, reason: firstGraded.reason }, { change: -100, reason: "fail" });
});

test("the balance may go negative and never blocks later rewards", () => {
  const database = makeDeterministicDatabase();
  submitSentence(database, { questionId: "S1-D1-Q1", score: 30 });
  submitSentence(database, { questionId: "S1-D1-Q2", score: 30 });
  assert.equal(database.getWalletBalance(), -200);

  assert.equal(submitSentence(database, { questionId: "S1-D1-Q3", score: 100 }).change, 200);
  assert.equal(database.getWalletBalance(), 0);
});

test("withdrawal requires the threshold, zeroes the balance and tracks pending/paid", () => {
  const database = makeDeterministicDatabase();
  assert.throws(() => database.createWithdrawal(), /还差/);

  database.adjustWallet(1100, "测试充值");
  const withdrawal = database.createWithdrawal();
  assert.equal(withdrawal.amountCents, 1100);
  assert.equal(withdrawal.balance, 0);
  assert.equal(database.getWalletBalance(), 0);

  const pending = database.listWithdrawals();
  assert.equal(pending.length, 1);
  assert.deepEqual(
    { amount: pending[0].amount_cents, status: pending[0].status },
    { amount: -1100, status: "pending" }
  );

  assert.equal(database.markWithdrawalPaid(withdrawal.id), true);
  assert.equal(database.markWithdrawalPaid(withdrawal.id), false);
  assert.equal(database.listWithdrawals()[0].status, "paid");
  assert.equal(database.getWalletBalance(), 0);
});

test("manual adjustments accept signed amounts and require a note", () => {
  const database = makeDatabase();
  database.adjustWallet(500, "周末加餐");
  database.adjustWallet(-300, "买贴纸");
  assert.equal(database.getWalletBalance(), 200);

  assert.throws(() => database.adjustWallet(0, "零"), /非零整数/);
  assert.throws(() => database.adjustWallet(100, "  "), /调整原因/);
  assert.throws(() => database.adjustWallet(Number.NaN, "坏数字"), /非零整数/);
});

test("wallet settings round-trip and reject invalid values", () => {
  const database = makeDatabase();
  const saved = database.updateWalletSettings({ rewardMinCents: 200, rewardMaxCents: 500, withdrawThresholdCents: 2000 });
  assert.equal(saved.rewardMinCents, 200);
  assert.equal(saved.rewardMaxCents, 500);
  assert.equal(saved.withdrawThresholdCents, 2000);
  assert.equal(saved.penaltyMinCents, 100);

  assert.throws(() => database.updateWalletSettings({ rewardMinCents: 600, rewardMaxCents: 300 }), /下限不能大于上限/);
  assert.throws(() => database.updateWalletSettings({ penaltyMinCents: 150 }), /整数元/);
  assert.throws(() => database.updateWalletSettings({ withdrawThresholdCents: 0 }), /整数元/);
});

test("wallet transactions list paginates and filters by type", () => {
  const database = makeDeterministicDatabase();
  submitSentence(database, { questionId: "S1-D1-Q1", score: 100 });
  submitSentence(database, { questionId: "S1-D1-Q2", score: 30 });
  database.adjustWallet(1000, "充值");
  database.createWithdrawal();

  assert.equal(database.walletTransactions(50, 0).total, 4);
  assert.equal(database.walletTransactions(2, 0).items.length, 2);
  const rewards = database.walletTransactions(50, 0, "reward");
  assert.equal(rewards.total, 1);
  assert.equal(rewards.items[0].ref_id, "S1-D1-Q1");
});
