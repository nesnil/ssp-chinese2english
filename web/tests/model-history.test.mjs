import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { AppDatabase } from "../dist/server/db.js";
import { gradeWordRecall } from "../dist/server/grader.js";
import { generateWordAudio } from "../dist/server/tts.js";
import { parseWalletCommand } from "../dist/server/walletIntent.js";

const tempRoot = await mkdtemp(path.join(os.tmpdir(), "c2e-model-history-test-"));

function makeDatabase() {
  return new AppDatabase({
    port: 3000,
    databasePath: path.join(tempRoot, `${randomUUID()}.sqlite`),
    aiTimeoutMs: 30000,
    reviewScoreThreshold: 80,
    nodeEnv: "test",
    ttsTimeoutMs: 30000,
    wordAudioGeneratedDir: path.join(tempRoot, "generated")
  });
}

function aiConfig() {
  return {
    baseUrl: "https://ai.example.com/v1",
    apiKey: "secret-ai-key",
    model: "test-model",
    timeoutMs: 5000,
    reviewScoreThreshold: 80
  };
}

function volcSettings() {
  return {
    provider: "volcengine",
    baseUrl: "https://openspeech.bytedance.com/api/v3/tts/unidirectional",
    format: "mp3",
    timeoutMs: 30000,
    accessToken: "secret-tts-key",
    cluster: "seed-tts-2.0",
    voiceType: "zh_female_cancan_mars_bigtts",
    encoding: "mp3",
    configured: true,
    updatedAt: null
  };
}

function sampleWord() {
  return {
    id: "w_history",
    sourceId: "history",
    name: "history",
    sortIndex: 1,
    definitions: [{ phonetic: "", partOfSpeech: "n.", meaning: "历史" }],
    examples: [],
    similar: [],
    tags: ["all"],
    audioPath: null
  };
}

function chatResponse(content) {
  return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(content) } }] }), { status: 200 });
}

test("model interaction history stores listable and searchable records", () => {
  const database = makeDatabase();
  const id = database.recordModelInteraction({
    kind: "grading",
    operation: "sentence-grade",
    refType: "question",
    refId: "S1-D1-Q1",
    status: "success",
    provider: "openai-compatible",
    model: "deepseek-test",
    request: { messages: [{ role: "user", content: "学生答案" }] },
    response: { content: "{\"score\":100}" },
    durationMs: 12
  });
  database.recordModelInteraction({
    kind: "tts",
    operation: "word-audio-generate",
    refType: "word",
    refId: "w_history",
    status: "error",
    provider: "volcengine",
    model: "seed-tts-2.0",
    request: { input: "history" },
    errorMessage: "bad token",
    durationMs: 8
  });

  const gradingPage = database.modelInteractions({ kind: "grading", limit: 10, offset: 0 });
  assert.equal(gradingPage.total, 1);
  assert.equal(gradingPage.items[0].id, id);
  assert.equal(gradingPage.items[0].operation, "sentence-grade");

  const searchPage = database.modelInteractions({ q: "bad token", limit: 10, offset: 0 });
  assert.equal(searchPage.total, 1);
  assert.equal(searchPage.items[0].kind, "tts");

  const detail = database.getModelInteraction(id);
  assert.equal(detail?.ref_id, "S1-D1-Q1");
  assert.equal(JSON.parse(detail.request_json).messages[0].content, "学生答案");
  assert.equal(JSON.parse(detail.response_json).content, "{\"score\":100}");
});

test("grading, TTS, and Siri calls emit sanitized model history entries", async () => {
  const entries = [];
  const log = (entry) => entries.push(entry);
  const word = sampleWord();

  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () =>
      chatResponse({
        score: 100,
        level: "优秀",
        encouragement: "满分！",
        issues: [],
        suggestion: "满分彩蛋",
        improvedAnswer: "history",
        needsReview: false
      });
    await gradeWordRecall(aiConfig(), word, { wordAnswer: "history", meaningAnswers: { "n.": "历史" } }, {
      kind: "grading",
      operation: "word-recall",
      refType: "word",
      refId: word.id,
      log
    });

    globalThis.fetch = async () => chatResponse({ action: "add", amountYuan: 5, note: "表现好" });
    await parseWalletCommand(aiConfig(), "加5元，表现好", {
      kind: "siri",
      operation: "siri-wallet-command",
      refType: "wallet",
      refId: "command",
      log
    });

    const audioDir = await mkdtemp(path.join(tempRoot, "audio-"));
    const fetchImpl = async () =>
      new Response(JSON.stringify({ code: 0, data: Buffer.from("mp3").toString("base64") }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    const audio = await generateWordAudio(
      {
        port: 3000,
        databasePath: path.join(tempRoot, "tts.sqlite"),
        aiTimeoutMs: 30000,
        reviewScoreThreshold: 80,
        nodeEnv: "test",
        ttsTimeoutMs: 30000,
        wordAudioGeneratedDir: audioDir
      },
      volcSettings(),
      { id: word.id, name: word.name },
      fetchImpl,
      {
        kind: "tts",
        operation: "word-audio-generate",
        refType: "word",
        refId: word.id,
        log
      }
    );
    assert.equal(await readFile(audio.absolutePath, "utf8"), "mp3");
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.deepEqual(entries.map((entry) => `${entry.kind}:${entry.operation}:${entry.status}`), [
    "grading:word-recall:success",
    "siri:siri-wallet-command:success",
    "tts:word-audio-generate:success"
  ]);
  const serialized = JSON.stringify(entries);
  assert.doesNotMatch(serialized, /secret-ai-key|secret-tts-key/i);
  assert.match(serialized, /history/);
  assert.match(serialized, /加5元/);
});
