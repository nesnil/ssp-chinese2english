import assert from "node:assert/strict";
import test from "node:test";

import {
  SIRI_ADJUST_MAX_YUAN,
  intentToAdjustCents,
  normalizeWalletIntent,
  parseWalletCommand
} from "../dist/server/walletIntent.js";

const aiConfig = { baseUrl: "https://ai.example.com/v1", apiKey: "test-key", model: "test-model", timeoutMs: 5000 };

function mockFetch(handler) {
  const original = globalThis.fetch;
  globalThis.fetch = handler;
  return () => {
    globalThis.fetch = original;
  };
}

function chatResponse(content) {
  return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(content) } }] }), { status: 200 });
}

test("normalizeWalletIntent keeps valid add/deduct/query intents", () => {
  assert.deepEqual(normalizeWalletIntent({ action: "add", amountYuan: 5, note: "今天作业全对" }), {
    action: "add",
    amountYuan: 5,
    note: "今天作业全对"
  });
  assert.deepEqual(normalizeWalletIntent({ action: "deduct", amountYuan: 2, note: null }), {
    action: "deduct",
    amountYuan: 2,
    note: null
  });
  assert.deepEqual(normalizeWalletIntent({ action: "query", amountYuan: 99, note: "无关" }), {
    action: "query",
    amountYuan: null,
    note: null
  });
});

test("normalizeWalletIntent collapses garbage to unknown", () => {
  assert.equal(normalizeWalletIntent(null).action, "unknown");
  assert.equal(normalizeWalletIntent("加5元").action, "unknown");
  assert.equal(normalizeWalletIntent({ action: "transfer", amountYuan: 5 }).action, "unknown");
  assert.equal(normalizeWalletIntent({ action: "add" }).action, "unknown");
  assert.equal(normalizeWalletIntent({ action: "add", amountYuan: -5 }).action, "unknown");
  assert.equal(normalizeWalletIntent({ action: "add", amountYuan: "many" }).action, "unknown");
});

test("normalizeWalletIntent trims and caps the note", () => {
  const intent = normalizeWalletIntent({ action: "add", amountYuan: 1, note: `  ${"很".repeat(200)}  ` });
  assert.equal(intent.note.length, 100);
});

test("intentToAdjustCents converts yuan to signed cents", () => {
  assert.equal(intentToAdjustCents({ action: "add", amountYuan: 5, note: null }), 500);
  assert.equal(intentToAdjustCents({ action: "deduct", amountYuan: 2.5, note: null }), -250);
});

test("intentToAdjustCents rejects unknown intents and bad amounts with speakable errors", () => {
  assert.throws(() => intentToAdjustCents({ action: "unknown", amountYuan: null, note: null }), /没听懂/);
  assert.throws(() => intentToAdjustCents({ action: "query", amountYuan: null, note: null }), /没听懂/);
  assert.throws(() => intentToAdjustCents({ action: "add", amountYuan: null, note: null }), /没听清金额/);
  assert.throws(() => intentToAdjustCents({ action: "add", amountYuan: SIRI_ADJUST_MAX_YUAN + 1, note: null }), /最多操作/);
  assert.throws(() => intentToAdjustCents({ action: "add", amountYuan: 0.001, note: null }), /金额太小/);
});

test("parseWalletCommand returns the normalized intent from the model", async () => {
  const restore = mockFetch(async () => chatResponse({ action: "add", amountYuan: 5, note: "今天作业全对" }));
  try {
    const intent = await parseWalletCommand(aiConfig, "给林沄加5元，因为今天作业全对");
    assert.deepEqual(intent, { action: "add", amountYuan: 5, note: "今天作业全对" });
  } finally {
    restore();
  }
});

test("parseWalletCommand falls back to unknown on model failure", async () => {
  const restoreHttpError = mockFetch(async () => new Response("boom", { status: 500 }));
  try {
    assert.equal((await parseWalletCommand(aiConfig, "加5元")).action, "unknown");
  } finally {
    restoreHttpError();
  }

  const restoreBadJson = mockFetch(async () =>
    new Response(JSON.stringify({ choices: [{ message: { content: "not json" } }] }), { status: 200 })
  );
  try {
    assert.equal((await parseWalletCommand(aiConfig, "加5元")).action, "unknown");
  } finally {
    restoreBadJson();
  }
});

test("parseWalletCommand requires AI config", async () => {
  await assert.rejects(() => parseWalletCommand({ timeoutMs: 5000 }, "加5元"), /配置不完整/);
});
