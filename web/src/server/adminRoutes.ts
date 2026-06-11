import type { Express, Request, RequestHandler } from "express";
import type { AiModelConfig, AppConfig, WordDefinition, WordExample } from "./types.js";
import { AppDatabase, type WalletTransactionRow } from "./db.js";
import { AiConfigError, testAiModelConnection } from "./grader.js";
import { getBank, reloadQuestionBank } from "./questionBank.js";
import { getWordBank, reloadWordBank, resolveAudioPathByName } from "./wordBank.js";

const QUESTIONS_PAGE_MAX = 200;
const WORDS_PAGE_MAX = 200;
const WALLET_PAGE_MAX = 200;

export function registerAdminRoutes(
  app: Express,
  database: AppDatabase,
  config: AppConfig,
  requireAdmin: RequestHandler
): void {
  // --- Model settings (AI 批改模型) ---

  app.get("/api/admin/model-settings", requireAdmin, (_req, res) => {
    res.json(adminModelSettings(database.getAiModelSettings(config)));
  });

  app.patch("/api/admin/model-settings", requireAdmin, (req, res) => {
    const current = database.getAiModelSettings(config);
    const input = readModelSettingsInput(req.body, current);

    if (!input.baseUrl || !input.apiKey || !input.model) {
      res.status(400).json({ error: "请填写 Base URL、API Key 和模型名称。" });
      return;
    }

    try {
      res.json(
        adminModelSettings(
          database.updateAiModelSettings({
            baseUrl: input.baseUrl,
            apiKey: input.apiKey,
            model: input.model,
            timeoutMs: input.timeoutMs
          })
        )
      );
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : "模型配置保存失败。" });
    }
  });

  app.post("/api/admin/model-settings/test", requireAdmin, async (req, res) => {
    const current = database.getAiModelSettings(config);
    const input = readModelSettingsInput(req.body, current);

    if (!input.baseUrl || !input.apiKey || !input.model) {
      res.status(400).json({ error: "请填写 Base URL、API Key 和模型名称后再测试。" });
      return;
    }

    try {
      await testAiModelConnection(input);
      res.json({ ok: true, message: "模型连接测试通过。" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "模型连接测试失败。";
      res.status(error instanceof AiConfigError ? 400 : 502).json({ error: message });
    }
  });

  // --- Wallet (钱包) ---

  app.get("/api/admin/wallet-settings", requireAdmin, (_req, res) => {
    res.json(database.getWalletSettings());
  });

  app.patch("/api/admin/wallet-settings", requireAdmin, (req, res) => {
    try {
      res.json(database.updateWalletSettings(readWalletSettingsInput(req.body)));
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : "钱包配置保存失败。" });
    }
  });

  app.get("/api/admin/wallet/transactions", requireAdmin, (req, res) => {
    const { limit, offset } = pageParams(req, WALLET_PAGE_MAX);
    const type = String(req.query.type || "").trim() || undefined;
    const { total, items } = database.walletTransactions(limit, offset, type);
    res.json({
      total,
      limit,
      offset,
      balanceCents: database.getWalletBalance(),
      items: items.map(walletTxToJson)
    });
  });

  app.post("/api/admin/wallet/withdrawals/:id/paid", requireAdmin, (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || !database.markWithdrawalPaid(id)) {
      res.status(404).json({ error: "没有找到待发放的提现记录。" });
      return;
    }
    res.json({ ok: true });
  });

  app.post("/api/admin/wallet/adjust", requireAdmin, (req, res) => {
    try {
      const result = database.adjustWallet(Number(req.body?.amountCents), String(req.body?.note || ""));
      res.json({ ok: true, balanceCents: result.balance });
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : "钱包调整失败。" });
    }
  });

  // --- Questions (中译英) ---

  // Season/Day tree for the admin filter dropdowns.
  app.get("/api/admin/question-meta", requireAdmin, (_req, res) => {
    res.json({
      seasons: getBank().seasons.map((season) => ({
        season: season.season,
        questionCount: season.questionCount,
        days: season.days.map((day) => ({ day: day.day, questionCount: day.questionCount }))
      }))
    });
  });

  app.get("/api/admin/questions", requireAdmin, (req, res) => {
    const season = optionalNumber(req.query.season);
    const day = optionalNumber(req.query.day);
    const q = String(req.query.q || "").trim();
    const { limit, offset } = pageParams(req, QUESTIONS_PAGE_MAX);

    const conditions: string[] = [];
    const params: Array<string | number> = [];
    if (season !== null) {
      conditions.push("season = ?");
      params.push(season);
    }
    if (day !== null) {
      conditions.push("day = ?");
      params.push(day);
    }
    if (q) {
      conditions.push("(chinese LIKE ? OR prompt LIKE ? OR reference_answer LIKE ? OR id LIKE ?)");
      const like = `%${q}%`;
      params.push(like, like, like, like);
    }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const total = database.queryCount(`SELECT COUNT(*) AS n FROM questions ${where}`, params);
    const rows = database.queryQuestionPage(where, params, limit, offset);
    res.json({ total, limit, offset, items: rows.map(adminQuestion) });
  });

  app.get("/api/admin/questions/:id", requireAdmin, (req, res) => {
    const row = database.getQuestionRow(String(req.params.id));
    if (!row) {
      res.status(404).json({ error: "没有找到这道题。" });
      return;
    }
    res.json(adminQuestion(row));
  });

  app.post("/api/admin/questions", requireAdmin, (req, res) => {
    const season = Number(req.body?.season);
    const day = Number(req.body?.day);
    const questionNo = Number(req.body?.questionNo);
    const chinese = String(req.body?.chinese || "").trim();
    const prompt = String(req.body?.prompt || "").trim();
    const sourceText = String(req.body?.sourceText || "").trim();
    const referenceAnswer = String(req.body?.referenceAnswer || "").trim();

    if (!Number.isInteger(season) || !Number.isInteger(day) || !Number.isInteger(questionNo)) {
      res.status(400).json({ error: "请填写正确的 Season、Day 和题号。" });
      return;
    }
    if (!chinese || !referenceAnswer) {
      res.status(400).json({ error: "请填写中文题目和参考答案。" });
      return;
    }

    const id = `S${season}-D${day}-Q${questionNo}`;
    if (database.getQuestionRow(id)) {
      res.status(409).json({ error: `题目 ${id} 已存在。` });
      return;
    }

    database.insertQuestion({
      id,
      season,
      day,
      question_no: questionNo,
      chinese,
      prompt,
      source_text: sourceText || (prompt ? `${chinese} (${prompt})` : chinese),
      reference_answer: referenceAnswer,
      sort_index: database.nextQuestionSortIndex()
    });
    reloadQuestionBank();
    res.json(adminQuestion(database.getQuestionRow(id)!));
  });

  app.patch("/api/admin/questions/:id", requireAdmin, (req, res) => {
    const id = String(req.params.id);
    const existing = database.getQuestionRow(id);
    if (!existing) {
      res.status(404).json({ error: "没有找到这道题。" });
      return;
    }

    const chinese = req.body?.chinese === undefined ? existing.chinese : String(req.body.chinese).trim();
    const prompt = req.body?.prompt === undefined ? existing.prompt : String(req.body.prompt).trim();
    const sourceText = req.body?.sourceText === undefined ? existing.source_text : String(req.body.sourceText).trim();
    const referenceAnswer =
      req.body?.referenceAnswer === undefined ? existing.reference_answer : String(req.body.referenceAnswer).trim();

    if (!chinese || !referenceAnswer) {
      res.status(400).json({ error: "中文题目和参考答案不能为空。" });
      return;
    }

    database.updateQuestion(id, {
      chinese,
      prompt,
      source_text: sourceText,
      reference_answer: referenceAnswer
    });
    reloadQuestionBank();
    res.json(adminQuestion(database.getQuestionRow(id)!));
  });

  app.delete("/api/admin/questions/:id", requireAdmin, (req, res) => {
    const id = String(req.params.id);
    if (!database.getQuestionRow(id)) {
      res.status(404).json({ error: "没有找到这道题。" });
      return;
    }
    const submissionCount = database.countQuestionSubmissions(id);
    database.deleteQuestion(id);
    reloadQuestionBank();
    res.json({ ok: true, deletedId: id, submissionCount });
  });

  // --- Words (单词) ---

  // Available word categories (tags) with current counts, for the admin filter + editor.
  app.get("/api/admin/word-tags", requireAdmin, (_req, res) => {
    res.json({ tags: getWordBank().tags });
  });

  app.get("/api/admin/words", requireAdmin, (req, res) => {
    const tag = String(req.query.tag || "").trim();
    const q = String(req.query.q || "").trim();
    const letter = String(req.query.letter || "").trim().toLowerCase();
    const { limit, offset } = pageParams(req, WORDS_PAGE_MAX);

    const conditions: string[] = [];
    const params: Array<string | number> = [];
    if (tag && tag !== "all") {
      conditions.push("tags_json LIKE ?");
      params.push(`%${JSON.stringify(tag).slice(1, -1)}%`);
    }
    if (letter && /^[a-z]$/.test(letter)) {
      conditions.push("LOWER(name) LIKE ?");
      params.push(`${letter}%`);
    }
    if (q) {
      conditions.push("(name LIKE ? OR id LIKE ? OR definitions_json LIKE ?)");
      const like = `%${q}%`;
      params.push(like, like, like);
    }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const total = database.queryCount(`SELECT COUNT(*) AS n FROM words ${where}`, params);
    const rows = database.queryWordPage(where, params, limit, offset);
    res.json({ total, limit, offset, items: rows.map(adminWord) });
  });

  app.get("/api/admin/words/:id", requireAdmin, (req, res) => {
    const row = database.getWordRow(String(req.params.id));
    if (!row) {
      res.status(404).json({ error: "没有找到这个单词。" });
      return;
    }
    res.json(adminWord(row));
  });

  app.post("/api/admin/words", requireAdmin, (req, res) => {
    const name = String(req.body?.name || "").trim();
    const definitions = normalizeDefinitions(req.body?.definitions);
    const examples = normalizeExamples(req.body?.examples);
    const tags = normalizeTags(req.body?.tags);

    if (!name) {
      res.status(400).json({ error: "请填写单词。" });
      return;
    }
    if (definitions.length === 0) {
      res.status(400).json({ error: "请至少填写一条中文释义。" });
      return;
    }
    if (examples.length === 0) {
      res.status(400).json({ error: "请至少填写一条例句（练习例句默写需要）。" });
      return;
    }

    const id = `w_${Buffer.from(name).toString("base64url")}`;
    if (database.getWordRow(id)) {
      res.status(409).json({ error: `单词 ${name} 已存在。` });
      return;
    }

    database.insertWord({
      id,
      source_id: name,
      name,
      sort_index: database.nextWordSortIndex(),
      definitions_json: JSON.stringify(definitions),
      examples_json: JSON.stringify(examples),
      similar_json: "[]",
      tags_json: JSON.stringify(ensureAllTag(tags)),
      audio_path: resolveAudioPathByName(config, name)
    });
    reloadWordBank();
    res.json(adminWord(database.getWordRow(id)!));
  });

  app.patch("/api/admin/words/:id", requireAdmin, (req, res) => {
    const id = String(req.params.id);
    const existing = database.getWordRow(id);
    if (!existing) {
      res.status(404).json({ error: "没有找到这个单词。" });
      return;
    }

    const name = req.body?.name === undefined ? existing.name : String(req.body.name).trim();
    const definitions =
      req.body?.definitions === undefined ? parseArray(existing.definitions_json) : normalizeDefinitions(req.body.definitions);
    const examples =
      req.body?.examples === undefined ? parseArray(existing.examples_json) : normalizeExamples(req.body.examples);
    const tags = req.body?.tags === undefined ? parseArray<string>(existing.tags_json) : normalizeTags(req.body.tags);

    if (!name) {
      res.status(400).json({ error: "单词不能为空。" });
      return;
    }
    if (definitions.length === 0) {
      res.status(400).json({ error: "请至少保留一条中文释义。" });
      return;
    }
    if (examples.length === 0) {
      res.status(400).json({ error: "请至少保留一条例句。" });
      return;
    }

    // id stays fixed (it is the join key for word_submissions); only name/content change.
    const audioPath = name === existing.name ? existing.audio_path : resolveAudioPathByName(config, name);
    database.updateWord(id, {
      name,
      definitions_json: JSON.stringify(definitions),
      examples_json: JSON.stringify(examples),
      tags_json: JSON.stringify(ensureAllTag(tags)),
      audio_path: audioPath
    });
    reloadWordBank();
    res.json(adminWord(database.getWordRow(id)!));
  });

  app.delete("/api/admin/words/:id", requireAdmin, (req, res) => {
    const id = String(req.params.id);
    if (!database.getWordRow(id)) {
      res.status(404).json({ error: "没有找到这个单词。" });
      return;
    }
    const submissionCount = database.countWordSubmissions(id);
    database.deleteWord(id);
    reloadWordBank();
    res.json({ ok: true, deletedId: id, submissionCount });
  });
}

// --- serializers ---

function adminQuestion(row: NonNullable<ReturnType<AppDatabase["getQuestionRow"]>>) {
  return {
    id: row.id,
    season: row.season,
    day: row.day,
    questionNo: row.question_no,
    chinese: row.chinese,
    prompt: row.prompt,
    sourceText: row.source_text,
    referenceAnswer: row.reference_answer
  };
}

function adminWord(row: NonNullable<ReturnType<AppDatabase["getWordRow"]>>) {
  return {
    id: row.id,
    name: row.name,
    definitions: parseArray<WordDefinition>(row.definitions_json),
    examples: parseArray<WordExample>(row.examples_json),
    tags: parseArray<string>(row.tags_json),
    hasAudio: Boolean(row.audio_path)
  };
}

function adminModelSettings(settings: ReturnType<AppDatabase["getAiModelSettings"]>) {
  return {
    baseUrl: settings.baseUrl || "",
    model: settings.model || "",
    timeoutMs: settings.timeoutMs,
    configured: settings.configured,
    apiKeySet: Boolean(settings.apiKey),
    updatedAt: settings.updatedAt
  };
}

function readModelSettingsInput(body: unknown, current: ReturnType<AppDatabase["getAiModelSettings"]>): AiModelConfig {
  const payload = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const rawTimeoutMs = Number(payload.timeoutMs);
  return {
    baseUrl: String(payload.baseUrl || "").trim(),
    apiKey: String(payload.apiKey || "").trim() || current.apiKey || "",
    model: String(payload.model || "").trim(),
    timeoutMs: Number.isFinite(rawTimeoutMs) ? rawTimeoutMs : current.timeoutMs
  };
}

// --- helpers ---

export function walletTxToJson(row: WalletTransactionRow) {
  return {
    id: row.id,
    type: row.type,
    amountCents: row.amount_cents,
    source: row.source,
    refId: row.ref_id,
    submissionId: row.submission_id,
    score: row.score,
    status: row.status,
    paidAt: row.paid_at,
    note: row.note,
    createdAt: row.created_at
  };
}

// 各字段缺省时保持现值;非数字会传 NaN 进 db 校验并以中文报错拒绝。
function readWalletSettingsInput(body: unknown): Parameters<AppDatabase["updateWalletSettings"]>[0] {
  const record = (body || {}) as Record<string, unknown>;
  const read = (key: string): number | undefined => {
    const value = record[key];
    if (value === undefined || value === null || value === "") return undefined;
    return Number(value);
  };
  return {
    rewardMinCents: read("rewardMinCents"),
    rewardMaxCents: read("rewardMaxCents"),
    penaltyMinCents: read("penaltyMinCents"),
    penaltyMaxCents: read("penaltyMaxCents"),
    withdrawThresholdCents: read("withdrawThresholdCents")
  };
}

function pageParams(req: Request, max: number): { limit: number; offset: number } {
  const rawLimit = Number(req.query.limit);
  const rawOffset = Number(req.query.offset);
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(Math.floor(rawLimit), max) : 50;
  const offset = Number.isFinite(rawOffset) && rawOffset > 0 ? Math.floor(rawOffset) : 0;
  return { limit, offset };
}

function optionalNumber(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function normalizeDefinitions(value: unknown): WordDefinition[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => ({
      phonetic: String((entry as WordDefinition)?.phonetic || "").trim(),
      partOfSpeech: String((entry as WordDefinition)?.partOfSpeech || "").trim(),
      meaning: String((entry as WordDefinition)?.meaning || "").trim()
    }))
    .filter((definition) => definition.meaning);
}

function normalizeExamples(value: unknown): WordExample[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => ({
      english: String((entry as WordExample)?.english || "").trim(),
      chinese: String((entry as WordExample)?.chinese || "").trim()
    }))
    .filter((example) => example.english || example.chinese);
}

function normalizeTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((tag) => String(tag).trim()).filter(Boolean))];
}

function ensureAllTag(tags: string[]): string[] {
  return tags.includes("all") ? tags : ["all", ...tags];
}

function parseArray<T>(raw: string): T[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}
