import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { AppDatabase } from "../dist/server/db.js";

const tempRoot = await mkdtemp(path.join(os.tmpdir(), "c2e-admin-test-"));

function makeDatabase() {
  return new AppDatabase({
    port: 3000,
    databasePath: path.join(tempRoot, `${randomUUID()}.sqlite`),
    aiTimeoutMs: 30000,
    reviewScoreThreshold: 80,
    nodeEnv: "test"
  });
}

const seedQuestions = [
  { id: "S1-D1-Q1", season: 1, day: 1, questionNo: 1, chinese: "冰箱里有一些胡萝卜。", prompt: "carrot", referenceAnswer: "There are a few carrots in the fridge." },
  { id: "S1-D1-Q2", season: 1, day: 1, questionNo: 2, chinese: "她准时到达。", prompt: "arrive", referenceAnswer: "She arrived on time." }
];

const seedWords = [
  { id: "w_apple", name: "apple", definitions: [{ phonetic: "ˈæpl", partOfSpeech: "n.", meaning: "苹果" }], examples: [{ english: "I like apples.", chinese: "我喜欢苹果。" }], similar: [], tags: ["all", "shanghai-zhongkao"], audioPath: "apple.mp3" }
];

test("seeding is idempotent — second seed does not duplicate", () => {
  const db = makeDatabase();
  assert.equal(db.seedQuestionsIfEmpty(seedQuestions), true);
  assert.equal(db.seedQuestionsIfEmpty(seedQuestions), false);
  assert.equal(db.allQuestionRows().length, 2);

  assert.equal(db.seedWordsIfEmpty(seedWords, { "zhongkao.matchedSourceRows": 1 }), true);
  assert.equal(db.seedWordsIfEmpty(seedWords), false);
  assert.equal(db.allWordRows().length, 1);
});

test("question CRUD round-trip + sort_index", () => {
  const db = makeDatabase();
  db.seedQuestionsIfEmpty(seedQuestions);

  db.insertQuestion({
    id: "S9-D1-Q1",
    season: 9,
    day: 1,
    question_no: 1,
    chinese: "测试。",
    prompt: "test",
    source_text: "测试。 (test)",
    reference_answer: "A test.",
    sort_index: db.nextQuestionSortIndex()
  });
  assert.equal(db.allQuestionRows().length, 3);

  db.updateQuestion("S9-D1-Q1", { chinese: "改后。", prompt: "test", source_text: "x", reference_answer: "Edited." });
  assert.equal(db.getQuestionRow("S9-D1-Q1").reference_answer, "Edited.");
  assert.equal(db.getQuestionRow("S9-D1-Q1").chinese, "改后。");

  db.deleteQuestion("S9-D1-Q1");
  assert.equal(db.getQuestionRow("S9-D1-Q1"), undefined);
  assert.equal(db.allQuestionRows().length, 2);
});

test("word update keeps id fixed even when name changes", () => {
  const db = makeDatabase();
  db.seedWordsIfEmpty(seedWords);

  db.updateWord("w_apple", {
    name: "apples",
    definitions_json: JSON.stringify([{ phonetic: "", partOfSpeech: "n.", meaning: "苹果（复数）" }]),
    examples_json: JSON.stringify([{ english: "Apples are red.", chinese: "苹果是红的。" }]),
    tags_json: JSON.stringify(["all"]),
    audio_path: null
  });

  const row = db.getWordRow("w_apple");
  assert.equal(row.name, "apples");
  assert.equal(row.id, "w_apple"); // id is the stable join key — must not change with the name
});

test("delete warnings count referencing submissions, but submissions are preserved", () => {
  const db = makeDatabase();
  db.seedQuestionsIfEmpty(seedQuestions);
  db.saveSubmission({
    questionId: "S1-D1-Q1",
    season: 1,
    day: 1,
    questionNo: 1,
    answer: "x",
    grade: {
      score: 70,
      level: "继续加油",
      encouragement: "加油。",
      issues: [],
      suggestion: "检查。",
      improvedAnswer: "y",
      referenceAnswer: "There are a few carrots in the fridge.",
      needsReview: true
    },
    mode: "day"
  });

  assert.equal(db.countQuestionSubmissions("S1-D1-Q1"), 1);
  db.deleteQuestion("S1-D1-Q1");
  // submission row is intentionally left behind (history snapshot preserved)
  assert.equal(db.countQuestionSubmissions("S1-D1-Q1"), 1);
});

test("admin sessions carry a role; default sessions are user", () => {
  const db = makeDatabase();
  const userToken = db.createSession();
  const adminToken = db.createSession("admin");

  assert.equal(db.getSessionRole(userToken), "user");
  assert.equal(db.getSessionRole(adminToken), "admin");
  assert.equal(db.getSessionRole("not-a-real-token"), null);

  // both are valid sessions for requireAuth purposes
  assert.equal(db.hasSession(userToken), true);
  assert.equal(db.hasSession(adminToken), true);
});

test("reference meta round-trips", () => {
  const db = makeDatabase();
  db.setReferenceMeta("zhongkao.matchedSourceRows", "1650");
  assert.equal(db.getReferenceMeta("zhongkao.matchedSourceRows"), "1650");
  assert.equal(db.getReferenceMeta("missing"), null);
});

test("AI model settings fall back to startup config and can be updated", () => {
  const db = makeDatabase();
  const startup = {
    port: 3000,
    databasePath: "ignored.sqlite",
    deepseekBaseUrl: "https://api.deepseek.com",
    deepseekApiKey: "startup-key",
    deepseekModel: "deepseek-v4-flash",
    aiTimeoutMs: 30000,
    reviewScoreThreshold: 80,
    nodeEnv: "test"
  };

  const initial = db.getAiModelSettings(startup);
  assert.equal(initial.baseUrl, "https://api.deepseek.com");
  assert.equal(initial.apiKey, "startup-key");
  assert.equal(initial.model, "deepseek-v4-flash");
  assert.equal(initial.timeoutMs, 30000);
  assert.equal(initial.configured, true);

  const saved = db.updateAiModelSettings({
    baseUrl: "https://api.example.test/v1",
    apiKey: "saved-key",
    model: "custom-model",
    timeoutMs: 45000
  });
  assert.equal(saved.baseUrl, "https://api.example.test/v1");
  assert.equal(saved.apiKey, "saved-key");
  assert.equal(saved.model, "custom-model");
  assert.equal(saved.timeoutMs, 45000);

  const loaded = db.getAiModelSettings(startup);
  assert.equal(loaded.baseUrl, "https://api.example.test/v1");
  assert.equal(loaded.apiKey, "saved-key");
  assert.equal(loaded.model, "custom-model");
  assert.equal(loaded.timeoutMs, 45000);
});
