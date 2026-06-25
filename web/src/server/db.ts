import { mkdirSync } from "node:fs";
import path from "node:path";
import { createHash, randomBytes } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import type {
  AiModelConfig,
  AiModelSettings,
  AppConfig,
  GradeResult,
  TtsProvider,
  TtsSettings,
  TtsSettingsInput,
  WalletChange,
  WalletSettings,
  WordEntry
} from "./types.js";

type SubmissionRow = {
  question_id: string;
  season: number;
  day: number;
  question_no: number;
  score: number;
  needs_review: number;
  created_at: string;
};

type DayAttemptRow = {
  id: number;
  season: number;
  day: number;
  question_count: number;
  status: string;
  average_score: number | null;
  completed_at: string | null;
};

export type WordPracticeKind = "junior" | "senior";
type WordSubmissionPhase = "word" | "example";

type WordSessionRow = {
  id: number;
  practice_kind: WordPracticeKind;
  scope_tag: string;
  mode: string;
  level_id: string | null;
  word_count: number;
  status: string;
  started_at: string;
  completed_at: string | null;
};

type WordSubmissionRow = {
  word_id: string;
  practice_kind: WordPracticeKind;
  phase: WordSubmissionPhase;
  word_answer: string | null;
  meaning_answer_json: string;
  answer: string;
  score: number;
  level: string;
  encouragement: string;
  issues_json: string;
  suggestion: string;
  improved_answer: string;
  reference_answer: string;
  needs_review: number;
};

export type WordSessionSummary = {
  session: WordSessionRow;
  items: Array<{
    itemNo: number;
    wordId: string;
    score: number | null;
    level: string | null;
    errorSummary: string | null;
  }>;
  averageScore: number | null;
  submittedCount: number;
  errorCount: number;
};

export type ReviewSubmissionRow = SubmissionRow & {
  issues_json: string;
};

export type ReviewStats = {
  reviewedQuestionCount: number;
  reviewSubmissionCount: number;
  reviewMasteredQuestionCount: number;
  currentReviewCount: number;
};

export type ReviewHistoryQuestionRow = {
  question_id: string;
  season: number;
  day: number;
  question_no: number;
  review_count: number;
  best_score: number;
  latest_score: number;
  latest_answer: string;
  latest_issues_json: string;
  latest_review_at: string;
  current_score: number;
};

export type ReviewHistoryAttemptRow = {
  question_id: string;
  score: number;
  created_at: string;
};

export type ReviewHistoryRecordRow = {
  question_id: string;
  season: number;
  day: number;
  question_no: number;
  answer: string;
  score: number;
  level: string;
  issues_json: string;
  suggestion: string;
  created_at: string;
};

export type DayProgress = {
  submitted: number;
  completed: boolean;
  needsReview: boolean;
  bestAverage: number | null;
};

export type DayAttemptStats = {
  attemptCount: number;
  latestAverageScore: number | null;
  lastCompletedAt: string | null;
};

export type WordProgressStats = {
  totalWords: number;
  practicedWords: number;
  masteredWords: number;
  reviewWords: number;
  sessionCount: number;
  submissionCount: number;
};

export type WordReviewRow = {
  word_id: string;
  latest_score: number;
  latest_phase: WordSubmissionPhase;
  latest_issues_json: string;
  latest_at: string;
};

export type QuestionRow = {
  id: string;
  season: number;
  day: number;
  question_no: number;
  chinese: string;
  prompt: string;
  source_text: string;
  reference_answer: string;
  sort_index: number;
};

export type WordRow = {
  id: string;
  source_id: string;
  name: string;
  sort_index: number;
  definitions_json: string;
  examples_json: string;
  similar_json: string;
  tags_json: string;
  audio_path: string | null;
};

export type WalletTransactionRow = {
  id: number;
  type: string;
  amount_cents: number;
  source: string | null;
  ref_id: string | null;
  submission_id: number | null;
  score: number | null;
  status: string | null;
  paid_at: string | null;
  note: string | null;
  created_at: string;
};

export type ActivityPracticeStatus = "none" | "partial" | "complete";

export type ActivityPracticeSummary = {
  status: ActivityPracticeStatus;
  label: string;
  score: number | null;
  count: number;
  time: string | null;
};

export type ActivityCalendarEvent = {
  type: "sentence" | "word";
  practiceKind?: WordPracticeKind;
  label: string;
  detail: string;
  score: number | null;
  time: string | null;
  occurredAt: string | null;
};

export type ActivityCalendarDay = {
  date: string;
  completed: boolean;
  sentence: ActivityPracticeSummary;
  juniorWord: ActivityPracticeSummary;
  seniorWord: ActivityPracticeSummary;
  /** Backward-compatible aggregate for all vocabulary practice. Prefer juniorWord/seniorWord in new clients. */
  word: ActivityPracticeSummary;
  events: ActivityCalendarEvent[];
};

export type ActivityCalendar = {
  year: number;
  today: string;
  summary: {
    currentStreak: number;
    longestStreak: number;
    completedDays: number;
    totalPracticeCount: number;
    averageScore: number | null;
  };
  days: ActivityCalendarDay[];
};

type WalletSettleInput =
  | { source: "sentence"; questionId: string; submissionId: number; score: number; errorSummary?: string | null }
  | {
      source: "word";
      practiceKind?: WordPracticeKind;
      wordId: string;
      phase: WordSubmissionPhase;
      submissionId: number;
      score: number;
      errorSummary?: string | null;
    };

type SeedQuestion = {
  id: string;
  season: number;
  day: number;
  questionNo: number;
  chinese: string;
  prompt?: string;
  sourceText?: string;
  referenceAnswer: string;
};

type SeedWord = {
  id: string;
  sourceId?: string;
  name: string;
  definitions?: unknown;
  examples?: unknown;
  similar?: unknown;
  tags?: unknown;
  audioPath?: string | null;
};

export class AppDatabase {
  private db: DatabaseSync;

  constructor(config: AppConfig) {
    mkdirSync(path.dirname(config.databasePath), { recursive: true });
    this.db = new DatabaseSync(config.databasePath);
    this.db.exec("PRAGMA journal_mode = WAL;");
    this.db.exec("PRAGMA foreign_keys = ON;");
    this.init();
  }

  private init() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS app_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        token_hash TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        expires_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS submissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        question_id TEXT NOT NULL,
        season INTEGER NOT NULL,
        day INTEGER NOT NULL,
        question_no INTEGER NOT NULL,
        answer TEXT NOT NULL,
        score INTEGER NOT NULL,
        level TEXT NOT NULL,
        encouragement TEXT NOT NULL,
        issues_json TEXT NOT NULL,
        suggestion TEXT NOT NULL,
        improved_answer TEXT NOT NULL,
        reference_answer TEXT NOT NULL,
        needs_review INTEGER NOT NULL,
        raw_ai TEXT,
        error_summary TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_submissions_question ON submissions(question_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_submissions_day ON submissions(season, day, question_no);
      CREATE INDEX IF NOT EXISTS idx_submissions_created_at ON submissions(created_at);
      CREATE INDEX IF NOT EXISTS idx_sessions_token ON app_sessions(token_hash);

      CREATE TABLE IF NOT EXISTS day_attempts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        season INTEGER NOT NULL,
        day INTEGER NOT NULL,
        question_count INTEGER NOT NULL,
        status TEXT NOT NULL,
        average_score INTEGER,
        started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        completed_at TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_day_attempts_day ON day_attempts(season, day, status, completed_at DESC);
      CREATE INDEX IF NOT EXISTS idx_day_attempts_completed_at ON day_attempts(completed_at);

      CREATE TABLE IF NOT EXISTS word_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS model_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS tts_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS word_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        practice_kind TEXT NOT NULL DEFAULT 'junior',
        scope_tag TEXT NOT NULL,
        mode TEXT NOT NULL,
        level_id TEXT,
        word_count INTEGER NOT NULL,
        status TEXT NOT NULL,
        started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        completed_at TEXT
      );

      CREATE TABLE IF NOT EXISTS word_session_items (
        session_id INTEGER NOT NULL,
        word_id TEXT NOT NULL,
        item_no INTEGER NOT NULL,
        PRIMARY KEY (session_id, word_id),
        FOREIGN KEY (session_id) REFERENCES word_sessions(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS word_submissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id INTEGER,
        practice_kind TEXT NOT NULL DEFAULT 'junior',
        word_id TEXT NOT NULL,
        phase TEXT NOT NULL,
        word_answer TEXT,
        meaning_answer_json TEXT NOT NULL DEFAULT '{}',
        answer TEXT NOT NULL,
        score INTEGER NOT NULL,
        level TEXT NOT NULL,
        encouragement TEXT NOT NULL,
        issues_json TEXT NOT NULL,
        suggestion TEXT NOT NULL,
        improved_answer TEXT NOT NULL,
        reference_answer TEXT NOT NULL,
        needs_review INTEGER NOT NULL,
        raw_ai TEXT,
        error_summary TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (session_id) REFERENCES word_sessions(id) ON DELETE SET NULL
      );

      CREATE INDEX IF NOT EXISTS idx_word_sessions_status ON word_sessions(status, started_at DESC);
      CREATE INDEX IF NOT EXISTS idx_word_sessions_completed_at ON word_sessions(completed_at);
      CREATE INDEX IF NOT EXISTS idx_word_session_items_session ON word_session_items(session_id, item_no);
      CREATE INDEX IF NOT EXISTS idx_word_submissions_word ON word_submissions(word_id, phase, id DESC);
      CREATE INDEX IF NOT EXISTS idx_word_submissions_session ON word_submissions(session_id, word_id, phase);
      CREATE INDEX IF NOT EXISTS idx_word_submissions_created_at ON word_submissions(created_at);

      CREATE TABLE IF NOT EXISTS questions (
        id TEXT PRIMARY KEY,
        season INTEGER NOT NULL,
        day INTEGER NOT NULL,
        question_no INTEGER NOT NULL,
        chinese TEXT NOT NULL,
        prompt TEXT NOT NULL DEFAULT '',
        source_text TEXT NOT NULL DEFAULT '',
        reference_answer TEXT NOT NULL,
        sort_index INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_questions_day ON questions(season, day, question_no);

      CREATE TABLE IF NOT EXISTS words (
        id TEXT PRIMARY KEY,
        source_id TEXT NOT NULL DEFAULT '',
        name TEXT NOT NULL,
        sort_index INTEGER NOT NULL DEFAULT 0,
        definitions_json TEXT NOT NULL DEFAULT '[]',
        examples_json TEXT NOT NULL DEFAULT '[]',
        similar_json TEXT NOT NULL DEFAULT '[]',
        tags_json TEXT NOT NULL DEFAULT '[]',
        audio_path TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_words_name ON words(name);
      CREATE INDEX IF NOT EXISTS idx_words_sort ON words(sort_index);

      CREATE TABLE IF NOT EXISTS reference_meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS wallet_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        amount_cents INTEGER NOT NULL,
        source TEXT,
        ref_id TEXT,
        submission_id INTEGER,
        score INTEGER,
        status TEXT,
        paid_at TEXT,
        note TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_wallet_tx_ref ON wallet_transactions(type, source, ref_id);
      CREATE INDEX IF NOT EXISTS idx_wallet_tx_status ON wallet_transactions(type, status);

      CREATE TABLE IF NOT EXISTS wallet_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    this.addColumnIfMissing("submissions", "attempt_id", "INTEGER");
    this.addColumnIfMissing("submissions", "mode", "TEXT NOT NULL DEFAULT 'day'");
    this.addColumnIfMissing("word_sessions", "practice_kind", "TEXT NOT NULL DEFAULT 'junior'");
    this.addColumnIfMissing("word_sessions", "level_id", "TEXT");
    this.addColumnIfMissing("word_sessions", "average_score", "INTEGER");
    this.addColumnIfMissing("word_submissions", "practice_kind", "TEXT NOT NULL DEFAULT 'junior'");
    this.addColumnIfMissing("app_sessions", "role", "TEXT NOT NULL DEFAULT 'user'");
    this.db.exec("CREATE INDEX IF NOT EXISTS idx_submissions_attempt ON submissions(attempt_id, mode, question_no);");
    this.db.exec("CREATE INDEX IF NOT EXISTS idx_word_sessions_level ON word_sessions(practice_kind, scope_tag, mode, level_id, status, started_at DESC);");
  }

  private addColumnIfMissing(table: string, column: string, definition: string) {
    const rows = this.db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
    if (!rows.some((row) => row.name === column)) {
      try {
        this.db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition};`);
      } catch (error) {
        if (!(error instanceof Error) || !/duplicate column name/i.test(error.message)) throw error;
      }
    }
  }

  createSession(role: "user" | "admin" = "user"): string {
    const token = randomBytes(32).toString("base64url");
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString();
    this.db.prepare("INSERT INTO app_sessions (token_hash, expires_at, role) VALUES (?, ?, ?)").run(tokenHash, expiresAt, role);
    return token;
  }

  hasSession(token: string): boolean {
    const tokenHash = hashToken(token);
    const row = this.db
      .prepare("SELECT id FROM app_sessions WHERE token_hash = ? AND datetime(expires_at) > CURRENT_TIMESTAMP")
      .get(tokenHash);
    return Boolean(row);
  }

  getSessionRole(token: string): "user" | "admin" | null {
    const tokenHash = hashToken(token);
    const row = this.db
      .prepare("SELECT role FROM app_sessions WHERE token_hash = ? AND datetime(expires_at) > CURRENT_TIMESTAMP")
      .get(tokenHash) as { role: string } | undefined;
    if (!row) return null;
    return row.role === "admin" ? "admin" : "user";
  }

  deleteSession(token: string): void {
    this.db.prepare("DELETE FROM app_sessions WHERE token_hash = ?").run(hashToken(token));
  }

  pruneSessions(): void {
    this.db.prepare("DELETE FROM app_sessions WHERE datetime(expires_at) <= CURRENT_TIMESTAMP").run();
  }

  // --- Reference data: seeding, reads, and CRUD (questions + words) ---

  seedQuestionsIfEmpty(questions: SeedQuestion[]): boolean {
    const count = (this.db.prepare("SELECT COUNT(*) AS n FROM questions").get() as { n: number }).n;
    if (count > 0) return false;
    this.db.exec("BEGIN");
    try {
      const insert = this.db.prepare(`
        INSERT INTO questions (id, season, day, question_no, chinese, prompt, source_text, reference_answer, sort_index)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      questions.forEach((question, index) => {
        insert.run(
          question.id,
          question.season,
          question.day,
          question.questionNo,
          question.chinese,
          question.prompt || "",
          question.sourceText || "",
          question.referenceAnswer,
          index
        );
      });
      this.db.exec("COMMIT");
      return true;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  seedWordsIfEmpty(words: SeedWord[], meta: Record<string, string | number | null> = {}): boolean {
    const count = (this.db.prepare("SELECT COUNT(*) AS n FROM words").get() as { n: number }).n;
    if (count > 0) return false;
    this.db.exec("BEGIN");
    try {
      const insert = this.db.prepare(`
        INSERT INTO words (id, source_id, name, sort_index, definitions_json, examples_json, similar_json, tags_json, audio_path)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      words.forEach((word, index) => {
        insert.run(
          word.id,
          word.sourceId || "",
          word.name,
          index,
          JSON.stringify(word.definitions ?? []),
          JSON.stringify(word.examples ?? []),
          JSON.stringify(word.similar ?? []),
          JSON.stringify(word.tags ?? []),
          word.audioPath ?? null
        );
      });
      for (const [key, value] of Object.entries(meta)) {
        this.setReferenceMeta(key, value === null ? "" : String(value));
      }
      this.db.exec("COMMIT");
      return true;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  setReferenceMeta(key: string, value: string): void {
    this.db
      .prepare(`
        INSERT INTO reference_meta (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
      `)
      .run(key, value);
  }

  getReferenceMeta(key: string): string | null {
    const row = this.db.prepare("SELECT value FROM reference_meta WHERE key = ?").get(key) as { value: string } | undefined;
    return row ? row.value : null;
  }

  getAiModelSettings(fallback: AppConfig): AiModelSettings {
    const rows = this.db.prepare("SELECT key, value, updated_at FROM model_settings").all() as Array<{
      key: string;
      value: string;
      updated_at: string;
    }>;
    const values = new Map(rows.map((row) => [row.key, row.value]));
    const updatedAt =
      rows.reduce<string | null>((latest, row) => {
        if (!latest || row.updated_at > latest) return row.updated_at;
        return latest;
      }, null) || null;

    const timeoutMs = numberSetting(values.get("timeout_ms"), fallback.aiTimeoutMs);
    const settings = {
      baseUrl: stringSetting(values.get("base_url"), fallback.deepseekBaseUrl),
      apiKey: stringSetting(values.get("api_key"), fallback.deepseekApiKey),
      model: stringSetting(values.get("model"), fallback.deepseekModel),
      timeoutMs,
      configured: false,
      updatedAt
    };
    settings.configured = Boolean(settings.baseUrl && settings.apiKey && settings.model);
    return settings;
  }

  updateAiModelSettings(input: AiModelConfig): AiModelSettings {
    const baseUrl = (input.baseUrl || "").trim();
    const apiKey = (input.apiKey || "").trim();
    const model = (input.model || "").trim();
    const timeoutMs = numberSetting(String(input.timeoutMs), 30000);
    if (!baseUrl || !apiKey || !model) {
      throw new Error("请填写 Base URL、API Key 和模型名称。");
    }
    this.db.exec("BEGIN");
    try {
      const upsert = this.db.prepare(`
        INSERT INTO model_settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
      `);
      upsert.run("base_url", baseUrl);
      upsert.run("api_key", apiKey);
      upsert.run("model", model);
      upsert.run("timeout_ms", String(timeoutMs));
      this.db.exec("COMMIT");
      return this.getAiModelSettings({
        port: 3000,
        databasePath: "",
        aiTimeoutMs: timeoutMs,
        reviewScoreThreshold: 80,
        nodeEnv: "production",
        ttsTimeoutMs: 30000,
        wordAudioGeneratedDir: ""
      });
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  getTtsSettings(fallback: AppConfig): TtsSettings {
    const rows = this.db.prepare("SELECT key, value, updated_at FROM tts_settings").all() as Array<{
      key: string;
      value: string;
      updated_at: string;
    }>;
    const values = new Map(rows.map((row) => [row.key, row.value]));
    const updatedAt =
      rows.reduce<string | null>((latest, row) => {
        if (!latest || row.updated_at > latest) return row.updated_at;
        return latest;
      }, null) || null;
    const provider = ttsProviderSetting(values.get("provider"), fallback.ttsProvider);
    const timeoutMs = numberSetting(values.get("timeout_ms"), fallback.ttsTimeoutMs || 30000);
    const settings: TtsSettings = {
      provider,
      baseUrl: stringSetting(values.get("base_url"), fallback.ttsBaseUrl || defaultTtsBaseUrl(provider)),
      apiKey: stringSetting(values.get("api_key"), fallback.ttsApiKey),
      model: stringSetting(values.get("model"), fallback.ttsModel || "gpt-4o-mini-tts"),
      voice: stringSetting(values.get("voice"), fallback.ttsVoice || "alloy"),
      format: stringSetting(values.get("format"), fallback.ttsFormat || "mp3") || "mp3",
      timeoutMs,
      appId: stringSetting(values.get("app_id"), fallback.ttsAppId),
      accessToken: stringSetting(values.get("access_token"), fallback.ttsAccessToken),
      cluster: stringSetting(values.get("cluster"), fallback.ttsCluster),
      voiceType: stringSetting(values.get("voice_type"), fallback.ttsVoiceType),
      encoding: stringSetting(values.get("encoding"), fallback.ttsEncoding || "mp3") || "mp3",
      configured: false,
      updatedAt
    };
    settings.configured =
      provider === "volcengine"
        ? Boolean(settings.baseUrl && settings.accessToken && settings.cluster && settings.voiceType)
        : Boolean(settings.baseUrl && settings.apiKey && settings.model && settings.voice);
    return settings;
  }

  updateTtsSettings(input: TtsSettingsInput): TtsSettings {
    const provider = ttsProviderSetting(input.provider);
    const baseUrl = (input.baseUrl || "").trim() || defaultTtsBaseUrl(provider);
    const timeoutMs = numberSetting(String(input.timeoutMs || 30000), 30000);
    const format = (input.format || "mp3").trim() || "mp3";
    const encoding = (input.encoding || format || "mp3").trim() || "mp3";
    this.db.exec("BEGIN");
    try {
      const upsert = this.db.prepare(`
        INSERT INTO tts_settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
      `);
      const write = (key: string, value: string | undefined, keepEmpty = false) => {
        const text = (value || "").trim();
        if (!text && !keepEmpty) return;
        upsert.run(key, text);
      };
      write("provider", provider, true);
      write("base_url", baseUrl, true);
      write("timeout_ms", String(timeoutMs), true);
      write("format", format, true);
      write("encoding", encoding, true);
      write("model", input.model);
      write("voice", input.voice);
      write("api_key", input.apiKey);
      write("app_id", input.appId);
      write("access_token", input.accessToken);
      write("cluster", input.cluster);
      write("voice_type", input.voiceType);
      this.db.exec("COMMIT");
      return this.getTtsSettings({
        port: 3000,
        databasePath: "",
        aiTimeoutMs: 30000,
        reviewScoreThreshold: 80,
        nodeEnv: "production",
        ttsTimeoutMs: timeoutMs,
        wordAudioGeneratedDir: ""
      });
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  allQuestionRows(): QuestionRow[] {
    return this.db
      .prepare("SELECT id, season, day, question_no, chinese, prompt, source_text, reference_answer, sort_index FROM questions ORDER BY sort_index, season, day, question_no")
      .all() as QuestionRow[];
  }

  getQuestionRow(id: string): QuestionRow | undefined {
    return this.db
      .prepare("SELECT id, season, day, question_no, chinese, prompt, source_text, reference_answer, sort_index FROM questions WHERE id = ?")
      .get(id) as QuestionRow | undefined;
  }

  insertQuestion(input: QuestionRow): void {
    this.db
      .prepare(`
        INSERT INTO questions (id, season, day, question_no, chinese, prompt, source_text, reference_answer, sort_index)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        input.id,
        input.season,
        input.day,
        input.question_no,
        input.chinese,
        input.prompt,
        input.source_text,
        input.reference_answer,
        input.sort_index
      );
  }

  updateQuestion(id: string, fields: { chinese: string; prompt: string; source_text: string; reference_answer: string }): void {
    this.db
      .prepare(`
        UPDATE questions
        SET chinese = ?, prompt = ?, source_text = ?, reference_answer = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `)
      .run(fields.chinese, fields.prompt, fields.source_text, fields.reference_answer, id);
  }

  deleteQuestion(id: string): void {
    this.db.prepare("DELETE FROM questions WHERE id = ?").run(id);
  }

  countQuestionSubmissions(questionId: string): number {
    return (
      this.db.prepare("SELECT COUNT(*) AS n FROM submissions WHERE question_id = ?").get(questionId) as { n: number }
    ).n;
  }

  nextQuestionSortIndex(): number {
    const row = this.db.prepare("SELECT MAX(sort_index) AS m FROM questions").get() as { m: number | null };
    return (row.m ?? -1) + 1;
  }

  queryCount(sql: string, params: Array<string | number>): number {
    return (this.db.prepare(sql).get(...params) as { n: number }).n;
  }

  queryQuestionPage(where: string, params: Array<string | number>, limit: number, offset: number): QuestionRow[] {
    return this.db
      .prepare(
        `SELECT id, season, day, question_no, chinese, prompt, source_text, reference_answer, sort_index
         FROM questions ${where}
         ORDER BY season, day, question_no
         LIMIT ? OFFSET ?`
      )
      .all(...params, limit, offset) as QuestionRow[];
  }

  queryWordPage(where: string, params: Array<string | number>, limit: number, offset: number): WordRow[] {
    return this.db
      .prepare(
        `SELECT id, source_id, name, sort_index, definitions_json, examples_json, similar_json, tags_json, audio_path
         FROM words ${where}
         ORDER BY name COLLATE NOCASE, name, sort_index
         LIMIT ? OFFSET ?`
      )
      .all(...params, limit, offset) as WordRow[];
  }

  allWordRows(): WordRow[] {
    return this.db
      .prepare(
        "SELECT id, source_id, name, sort_index, definitions_json, examples_json, similar_json, tags_json, audio_path FROM words ORDER BY name COLLATE NOCASE, name, sort_index"
      )
      .all() as WordRow[];
  }

  getWordRow(id: string): WordRow | undefined {
    return this.db
      .prepare("SELECT id, source_id, name, sort_index, definitions_json, examples_json, similar_json, tags_json, audio_path FROM words WHERE id = ?")
      .get(id) as WordRow | undefined;
  }

  insertWord(input: WordRow): void {
    this.db
      .prepare(`
        INSERT INTO words (id, source_id, name, sort_index, definitions_json, examples_json, similar_json, tags_json, audio_path)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        input.id,
        input.source_id,
        input.name,
        input.sort_index,
        input.definitions_json,
        input.examples_json,
        input.similar_json,
        input.tags_json,
        input.audio_path
      );
  }

  updateWord(
    id: string,
    fields: { name: string; definitions_json: string; examples_json: string; tags_json: string; audio_path: string | null }
  ): void {
    this.db
      .prepare(`
        UPDATE words
        SET name = ?, definitions_json = ?, examples_json = ?, tags_json = ?, audio_path = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `)
      .run(fields.name, fields.definitions_json, fields.examples_json, fields.tags_json, fields.audio_path, id);
  }

  updateWordAudioPath(id: string, audioPath: string | null): void {
    this.db.prepare("UPDATE words SET audio_path = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(audioPath, id);
  }

  deleteWord(id: string): void {
    this.db.prepare("DELETE FROM words WHERE id = ?").run(id);
  }

  countWordSubmissions(wordId: string): number {
    return (this.db.prepare("SELECT COUNT(*) AS n FROM word_submissions WHERE word_id = ?").get(wordId) as { n: number })
      .n;
  }

  nextWordSortIndex(): number {
    const row = this.db.prepare("SELECT MAX(sort_index) AS m FROM words").get() as { m: number | null };
    return (row.m ?? -1) + 1;
  }

  saveSubmission(input: {
    questionId: string;
    season: number;
    day: number;
    questionNo: number;
    answer: string;
    grade: GradeResult;
    attemptId?: number | null;
    mode?: "day" | "review";
  }): number {
    const result = this.db
      .prepare(`
        INSERT INTO submissions (
          question_id, season, day, question_no, answer, score, level, encouragement,
          issues_json, suggestion, improved_answer, reference_answer, needs_review, raw_ai, error_summary,
          attempt_id, mode
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        input.questionId,
        input.season,
        input.day,
        input.questionNo,
        input.answer,
        input.grade.score,
        input.grade.level,
        input.grade.encouragement,
        JSON.stringify(input.grade.issues),
        input.grade.suggestion,
        input.grade.improvedAnswer,
        input.grade.referenceAnswer,
        input.grade.needsReview ? 1 : 0,
        input.grade.rawAi || null,
        input.grade.errorSummary || null,
        input.attemptId || null,
        input.mode || "day"
      );
    return Number(result.lastInsertRowid);
  }

  startDayAttempt(season: number, day: number, questionCount: number): number {
    const result = this.db
      .prepare("INSERT INTO day_attempts (season, day, question_count, status) VALUES (?, ?, ?, 'in_progress')")
      .run(season, day, questionCount);
    return Number(result.lastInsertRowid);
  }

  startOrResumeDayAttempt(season: number, day: number, questionCount: number) {
    let active = this.db
      .prepare(
        `
        SELECT *
        FROM day_attempts
        WHERE season = ?
          AND day = ?
          AND status = 'in_progress'
          AND id > COALESCE((
            SELECT MAX(id)
            FROM day_attempts
            WHERE season = ? AND day = ? AND status = 'completed'
          ), 0)
        ORDER BY id DESC
        LIMIT 1
      `
      )
      .get(season, day, season, day) as DayAttemptRow | undefined;

    if (active) {
      const completed = this.completeDayAttemptIfReady(active.id);
      if (!completed) {
        return {
          attemptId: active.id,
          resumed: true,
          submittedQuestionNos: this.getDayAttemptSubmittedQuestionNos(active.id)
        };
      }
    }

    const attemptId = this.startDayAttempt(season, day, questionCount);
    return { attemptId, resumed: false, submittedQuestionNos: [] as number[] };
  }

  getDayAttemptSubmittedQuestionNos(attemptId: number): number[] {
    const rows = this.db
      .prepare(
        `
        SELECT DISTINCT question_no
        FROM submissions
        WHERE attempt_id = ? AND mode = 'day'
        ORDER BY question_no
      `
      )
      .all(attemptId) as Array<{ question_no: number }>;
    return rows.map((row) => row.question_no);
  }

  getDayAttempt(attemptId: number): DayAttemptRow | null {
    return (this.db.prepare("SELECT * FROM day_attempts WHERE id = ?").get(attemptId) as DayAttemptRow | undefined) || null;
  }

  completeDayAttemptIfReady(attemptId: number): DayAttemptStats | null {
    const attempt = this.getDayAttempt(attemptId);
    if (!attempt || attempt.status === "completed") return null;

    const rows = this.db
      .prepare(`
        SELECT s.question_no, s.score
        FROM submissions s
        INNER JOIN (
          SELECT question_no, MAX(id) AS id
          FROM submissions
          WHERE attempt_id = ? AND mode = 'day'
          GROUP BY question_no
        ) latest ON latest.id = s.id
      `)
      .all(attemptId) as Array<{ question_no: number; score: number }>;

    const uniqueQuestions = new Set(rows.map((row) => row.question_no));
    if (uniqueQuestions.size < attempt.question_count) return null;

    const average = Math.round(rows.reduce((sum, row) => sum + row.score, 0) / rows.length);
    this.db
      .prepare("UPDATE day_attempts SET status = 'completed', average_score = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?")
      .run(average, attemptId);
    return this.getDayAttemptStats().get(`${attempt.season}:${attempt.day}`) || null;
  }

  getDayAttemptStats(): Map<string, DayAttemptStats> {
    const rows = this.db
      .prepare(`
        SELECT
          d.season,
          d.day,
          COUNT(*) AS attempt_count,
          (
            SELECT latest.average_score
            FROM day_attempts latest
            WHERE latest.season = d.season AND latest.day = d.day AND latest.status = 'completed'
            ORDER BY datetime(latest.completed_at) DESC, latest.id DESC
            LIMIT 1
          ) AS latest_average_score,
          (
            SELECT latest.completed_at
            FROM day_attempts latest
            WHERE latest.season = d.season AND latest.day = d.day AND latest.status = 'completed'
            ORDER BY datetime(latest.completed_at) DESC, latest.id DESC
            LIMIT 1
          ) AS last_completed_at
        FROM day_attempts d
        WHERE d.status = 'completed'
        GROUP BY d.season, d.day
      `)
      .all() as Array<{
      season: number;
      day: number;
      attempt_count: number;
      latest_average_score: number | null;
      last_completed_at: string | null;
    }>;

    return new Map(
      rows.map((row) => [
        `${row.season}:${row.day}`,
        {
          attemptCount: row.attempt_count,
          latestAverageScore: row.latest_average_score,
          lastCompletedAt: row.last_completed_at
        }
      ])
    );
  }

  getCompletedDayAverageScore(): number | null {
    const stats = [...this.getDayAttemptStats().values()].filter((item) => item.latestAverageScore !== null);
    if (stats.length === 0) return null;
    return Math.round(stats.reduce((sum, item) => sum + Number(item.latestAverageScore), 0) / stats.length);
  }

  backfillLegacyDayAttempts(dayQuestionCounts: Map<string, number>): void {
    const existing = this.getDayAttemptStats();
    const byDay = new Map<string, SubmissionRow[]>();
    for (const row of this.latestSubmissions()) {
      const key = `${row.season}:${row.day}`;
      const rows = byDay.get(key) || [];
      rows.push(row);
      byDay.set(key, rows);
    }

    for (const [key, questionCount] of dayQuestionCounts) {
      if (existing.has(key)) continue;
      const rows = byDay.get(key) || [];
      const uniqueQuestions = new Set(rows.map((row) => row.question_no));
      if (uniqueQuestions.size < questionCount) continue;
      const average = Math.round(rows.reduce((sum, row) => sum + row.score, 0) / rows.length);
      const [season, day] = key.split(":").map(Number);
      this.db
        .prepare(
          "INSERT INTO day_attempts (season, day, question_count, status, average_score, completed_at) VALUES (?, ?, ?, 'completed', ?, CURRENT_TIMESTAMP)"
        )
        .run(season, day, questionCount, average);
    }
  }

  latestSubmissions(): SubmissionRow[] {
    return this.db
      .prepare(`
        SELECT s.question_id, s.season, s.day, s.question_no, s.score, s.needs_review, s.created_at
        FROM submissions s
        INNER JOIN (
          SELECT question_id, MAX(id) AS id
          FROM submissions
          GROUP BY question_id
        ) latest ON latest.id = s.id
      `)
      .all() as SubmissionRow[];
  }

  recentSubmissions(limit = 8) {
    return this.db
      .prepare(`
        SELECT question_id AS questionId, season, day, question_no AS questionNo, score, needs_review AS needsReview, created_at AS createdAt
        FROM submissions
        ORDER BY id DESC
        LIMIT ?
      `)
      .all(limit);
  }

  latestReviewSubmissions(threshold: number): ReviewSubmissionRow[] {
    return this.db
      .prepare(`
        SELECT
          s.question_id,
          s.season,
          s.day,
          s.question_no,
          s.score,
          s.needs_review,
          s.issues_json,
          s.created_at
        FROM submissions s
        INNER JOIN (
          SELECT question_id, MAX(id) AS id
          FROM submissions
          GROUP BY question_id
        ) latest ON latest.id = s.id
        WHERE s.score < ?
        ORDER BY s.score ASC, datetime(s.created_at) ASC
      `)
      .all(threshold) as ReviewSubmissionRow[];
  }

  getReviewStats(threshold: number): ReviewStats {
    const row = this.db
      .prepare(`
        WITH
          reviewed AS (
            SELECT DISTINCT question_id
            FROM submissions
            WHERE mode = 'review'
          ),
          latest AS (
            SELECT s.question_id, s.score
            FROM submissions s
            INNER JOIN (
              SELECT question_id, MAX(id) AS id
              FROM submissions
              GROUP BY question_id
            ) latest ON latest.id = s.id
          )
        SELECT
          (SELECT COUNT(*) FROM reviewed) AS reviewed_question_count,
          (SELECT COUNT(*) FROM submissions WHERE mode = 'review') AS review_submission_count,
          (SELECT COUNT(*) FROM reviewed r INNER JOIN latest l ON l.question_id = r.question_id WHERE l.score >= ?) AS review_mastered_question_count,
          (SELECT COUNT(*) FROM latest WHERE score < ?) AS current_review_count
      `)
      .get(threshold, threshold) as {
      reviewed_question_count: number;
      review_submission_count: number;
      review_mastered_question_count: number;
      current_review_count: number;
    };

    return {
      reviewedQuestionCount: row.reviewed_question_count,
      reviewSubmissionCount: row.review_submission_count,
      reviewMasteredQuestionCount: row.review_mastered_question_count,
      currentReviewCount: row.current_review_count
    };
  }

  reviewHistory(recordLimit = 100): {
    questions: ReviewHistoryQuestionRow[];
    attempts: ReviewHistoryAttemptRow[];
    records: ReviewHistoryRecordRow[];
  } {
    const questions = this.db
      .prepare(`
        WITH
          review_summary AS (
            SELECT
              question_id,
              COUNT(*) AS review_count,
              MAX(score) AS best_score
            FROM submissions
            WHERE mode = 'review'
            GROUP BY question_id
          ),
          latest_review_ids AS (
            SELECT question_id, id
            FROM (
              SELECT
                question_id,
                id,
                ROW_NUMBER() OVER (PARTITION BY question_id ORDER BY datetime(created_at) DESC, id DESC) AS rank
              FROM submissions
              WHERE mode = 'review'
            )
            WHERE rank = 1
          ),
          latest_overall AS (
            SELECT s.question_id, s.score
            FROM submissions s
            INNER JOIN (
              SELECT question_id, MAX(id) AS id
              FROM submissions
              GROUP BY question_id
            ) latest ON latest.id = s.id
          )
        SELECT
          latest_review.question_id,
          latest_review.season,
          latest_review.day,
          latest_review.question_no,
          summary.review_count,
          summary.best_score,
          latest_review.score AS latest_score,
          latest_review.answer AS latest_answer,
          latest_review.issues_json AS latest_issues_json,
          latest_review.created_at AS latest_review_at,
          latest_overall.score AS current_score
        FROM review_summary summary
        INNER JOIN latest_review_ids latest_review_id ON latest_review_id.question_id = summary.question_id
        INNER JOIN submissions latest_review ON latest_review.id = latest_review_id.id
        INNER JOIN latest_overall ON latest_overall.question_id = summary.question_id
        ORDER BY datetime(latest_review.created_at) DESC, latest_review.id DESC
      `)
      .all() as ReviewHistoryQuestionRow[];

    const attempts = this.db
      .prepare(`
        SELECT question_id, score, created_at
        FROM submissions
        WHERE mode = 'review'
        ORDER BY datetime(created_at) ASC, id ASC
      `)
      .all() as ReviewHistoryAttemptRow[];

    const records = this.db
      .prepare(`
        SELECT
          question_id,
          season,
          day,
          question_no,
          answer,
          score,
          level,
          issues_json,
          suggestion,
          created_at
        FROM submissions
        WHERE mode = 'review'
        ORDER BY id DESC
        LIMIT ?
      `)
      .all(recordLimit) as ReviewHistoryRecordRow[];

    return { questions, attempts, records };
  }

  countSubmissions(): number {
    const row = this.db.prepare("SELECT COUNT(*) AS count FROM submissions").get() as { count: number };
    return row.count;
  }

  getWordBatchSize(practiceKind: WordPracticeKind = "junior"): number {
    const key = wordBatchSizeKey(practiceKind);
    const row = this.db.prepare("SELECT value FROM word_settings WHERE key = ?").get(key) as { value: string } | undefined;
    const parsed = row ? Number(row.value) : defaultWordBatchSize(practiceKind);
    return clampWordBatchSize(parsed, defaultWordBatchSize(practiceKind));
  }

  setWordBatchSize(value: number, practiceKind: WordPracticeKind = "junior"): number {
    const key = wordBatchSizeKey(practiceKind);
    const batchSize = clampWordBatchSize(value, defaultWordBatchSize(practiceKind));
    this.db
      .prepare(
        `
        INSERT INTO word_settings (key, value, updated_at)
        VALUES (?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
      `
      )
      .run(key, String(batchSize));
    return batchSize;
  }

  startWordSession(words: WordEntry[], scopeTag: string, mode: string, levelId: string | null = null, practiceKind: WordPracticeKind = "junior") {
    this.db.exec("BEGIN");
    try {
      const result = this.db
        .prepare(
          "INSERT INTO word_sessions (practice_kind, scope_tag, mode, level_id, word_count, status) VALUES (?, ?, ?, ?, ?, 'in_progress')"
        )
        .run(practiceKind, scopeTag, mode, levelId, words.length);
      const sessionId = Number(result.lastInsertRowid);
      const insertItem = this.db.prepare("INSERT INTO word_session_items (session_id, word_id, item_no) VALUES (?, ?, ?)");
      words.forEach((word, index) => insertItem.run(sessionId, word.id, index + 1));
      this.db.exec("COMMIT");
      return {
        sessionId,
        practiceKind,
        scopeTag,
        mode,
        levelId,
        wordCount: words.length,
        words: words.map((word, index) => ({ word, itemNo: index + 1 }))
      };
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  startOrResumeWordSession(
    words: WordEntry[],
    scopeTag: string,
    mode: string,
    levelId: string | null,
    threshold: number,
    practiceKind: WordPracticeKind = "junior"
  ) {
    let active = this.db
      .prepare(
        `
        SELECT *
        FROM word_sessions
        WHERE practice_kind = ?
          AND scope_tag = ?
          AND mode = ?
          AND COALESCE(level_id, '') = COALESCE(?, '')
          AND status = 'in_progress'
          AND id > COALESCE((
            SELECT MAX(id)
            FROM word_sessions
            WHERE practice_kind = ?
              AND scope_tag = ?
              AND mode = ?
              AND COALESCE(level_id, '') = COALESCE(?, '')
              AND status = 'completed'
          ), 0)
        ORDER BY id DESC
        LIMIT 1
      `
      )
      .get(practiceKind, scopeTag, mode, levelId, practiceKind, scopeTag, mode, levelId) as WordSessionRow | undefined;

    if (active && !this.wordSessionMatchesWords(active.id, words)) {
      this.markWordSessionStale(active.id);
      active = undefined;
    }

    if (!active && levelId) {
      const legacy = this.findLegacyWordLevelSession(scopeTag, mode, words, practiceKind);
      if (legacy) {
        this.db.prepare("UPDATE word_sessions SET level_id = ? WHERE id = ?").run(levelId, legacy.id);
        active = { ...legacy, level_id: levelId };
      }
    }

    if (active) {
      const completed = this.completeWordSessionIfReady(active.id, threshold);
      if (!completed) {
        return {
          sessionId: active.id,
          practiceKind,
          scopeTag,
          mode,
          levelId,
          wordCount: words.length,
          words: words.map((word, index) => ({ word, itemNo: index + 1 })),
          resumed: true,
          resume: this.getWordSessionResume(active.id, threshold)
        };
      }
    }

    return {
      ...this.startWordSession(words, scopeTag, mode, levelId, practiceKind),
      resumed: false,
      resume: null
    };
  }

  private wordSessionMatchesWords(sessionId: number, words: WordEntry[]): boolean {
    const existingWordIds = this.getWordSessionWordIds(sessionId);
    if (existingWordIds.length !== words.length) return false;
    return existingWordIds.every((wordId, index) => wordId === words[index]?.id);
  }

  private markWordSessionStale(sessionId: number) {
    this.db.prepare("UPDATE word_sessions SET status = 'stale' WHERE id = ? AND status = 'in_progress'").run(sessionId);
  }

  private findLegacyWordLevelSession(scopeTag: string, mode: string, words: WordEntry[], practiceKind: WordPracticeKind): WordSessionRow | null {
    const rows = this.db
      .prepare(
        `
        SELECT *
        FROM word_sessions
        WHERE practice_kind = ?
          AND scope_tag = ?
          AND mode = ?
          AND level_id IS NULL
          AND status = 'in_progress'
        ORDER BY id DESC
      `
      )
      .all(practiceKind, scopeTag, mode) as WordSessionRow[];
    const targetWordIds = words.map((word) => word.id).join("\u001f");
    for (const row of rows) {
      if (this.getWordSessionWordIds(row.id).join("\u001f") === targetWordIds) return row;
    }
    return null;
  }

  getWordSession(sessionId: number): WordSessionRow | null {
    return (this.db.prepare("SELECT * FROM word_sessions WHERE id = ?").get(sessionId) as WordSessionRow | undefined) || null;
  }

  getWordSessionWordIds(sessionId: number): string[] {
    const rows = this.db
      .prepare("SELECT word_id FROM word_session_items WHERE session_id = ? ORDER BY item_no")
      .all(sessionId) as Array<{ word_id: string }>;
    return rows.map((row) => row.word_id);
  }

  getWordSessionResume(sessionId: number, threshold: number) {
    const session = this.getWordSession(sessionId);
    const practiceKind = normalizePracticeKind(session?.practice_kind);
    const items = this.db
      .prepare("SELECT word_id, item_no FROM word_session_items WHERE session_id = ? ORDER BY item_no")
      .all(sessionId) as Array<{ word_id: string; item_no: number }>;
    const latestRows = this.latestWordSessionSubmissionRows(sessionId);
    for (const item of items) {
      const phases = latestRows.get(item.word_id);
      const wordRow = phases?.get("word");
      if (!wordRow) return { itemNo: item.item_no, phase: "word" as const };
      if (practiceKind === "senior") continue;
      if (wordRow.score >= threshold) {
        const exampleRow = phases?.get("example");
        if (!exampleRow) {
          return {
            itemNo: item.item_no,
            phase: "example" as const,
            wordAnswer: wordRow.word_answer || "",
            meaningAnswers: parseJsonObject(wordRow.meaning_answer_json),
            wordGrade: wordSubmissionRowToGrade(wordRow)
          };
        }
      }
    }
    return { itemNo: items.length + 1, phase: "complete" as const };
  }

  private latestWordSessionSubmissionRows(sessionId: number): Map<string, Map<WordSubmissionPhase, WordSubmissionRow>> {
    const rows = this.db
      .prepare(
        `
        SELECT
          ws.word_id, ws.phase, ws.word_answer, ws.meaning_answer_json, ws.answer, ws.score, ws.level,
          ws.practice_kind, ws.encouragement, ws.issues_json, ws.suggestion, ws.improved_answer, ws.reference_answer, ws.needs_review
        FROM word_submissions ws
        INNER JOIN (
          SELECT word_id, phase, MAX(id) AS id
          FROM word_submissions
          WHERE session_id = ?
          GROUP BY word_id, phase
        ) latest ON latest.id = ws.id
      `
      )
      .all(sessionId) as WordSubmissionRow[];
    const byWord = new Map<string, Map<WordSubmissionPhase, WordSubmissionRow>>();
    for (const row of rows) {
      const phases = byWord.get(row.word_id) || new Map<WordSubmissionPhase, WordSubmissionRow>();
      phases.set(row.phase, row);
      byWord.set(row.word_id, phases);
    }
    return byWord;
  }

  saveWordSubmission(input: {
    sessionId: number | null;
    practiceKind?: WordPracticeKind;
    wordId: string;
    phase: WordSubmissionPhase;
    wordAnswer?: string | null;
    meaningAnswers?: Record<string, string>;
    answer: string;
    grade: GradeResult;
  }): number {
    const practiceKind = input.practiceKind || (input.sessionId ? normalizePracticeKind(this.getWordSession(input.sessionId)?.practice_kind) : "junior");
    const result = this.db
      .prepare(`
        INSERT INTO word_submissions (
          session_id, practice_kind, word_id, phase, word_answer, meaning_answer_json, answer, score, level,
          encouragement, issues_json, suggestion, improved_answer, reference_answer, needs_review,
          raw_ai, error_summary
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        input.sessionId,
        practiceKind,
        input.wordId,
        input.phase,
        input.wordAnswer || null,
        JSON.stringify(input.meaningAnswers || {}),
        input.answer,
        input.grade.score,
        input.grade.level,
        input.grade.encouragement,
        JSON.stringify(input.grade.issues),
        input.grade.suggestion,
        input.grade.improvedAnswer,
        input.grade.referenceAnswer,
        input.grade.needsReview ? 1 : 0,
        input.grade.rawAi || null,
        input.grade.errorSummary || null
      );
    return Number(result.lastInsertRowid);
  }

  latestWordPhaseScore(wordId: string, phase: WordSubmissionPhase, practiceKind: WordPracticeKind = "junior"): number | null {
    const row = this.db
      .prepare("SELECT score FROM word_submissions WHERE practice_kind = ? AND word_id = ? AND phase = ? ORDER BY id DESC LIMIT 1")
      .get(practiceKind, wordId, phase) as { score: number } | undefined;
    return row?.score ?? null;
  }

  completeWordSessionIfReady(sessionId: number, threshold: number): boolean {
    const session = this.getWordSession(sessionId);
    if (!session || session.status === "completed") return Boolean(session?.status === "completed");

    const wordIds = this.getWordSessionWordIds(sessionId);
    if (wordIds.length === 0) return false;
    const latestRows = this.latestWordSessionSubmissionRows(sessionId);

    for (const wordId of wordIds) {
      const phases = latestRows.get(wordId);
      const wordRow = phases?.get("word");
      if (!wordRow) return false;
      if (session.practice_kind === "senior") continue;
      if (wordRow.score < threshold) continue;
      const exampleRow = phases?.get("example");
      if (!exampleRow) return false;
    }

    const averageScore = this.computeWordSessionAverage(sessionId);
    this.db
      .prepare("UPDATE word_sessions SET status = 'completed', average_score = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?")
      .run(averageScore, sessionId);
    return true;
  }

  getWordSessionSummary(sessionId: number): WordSessionSummary | null {
    const session = this.getWordSession(sessionId);
    if (!session) return null;
    const items = this.db
      .prepare(
        `
        SELECT
          i.item_no,
          i.word_id,
          ws.score,
          ws.level,
          ws.error_summary
        FROM word_session_items i
        LEFT JOIN word_submissions ws
          ON ws.id = (
            SELECT MAX(latest.id)
            FROM word_submissions latest
            WHERE latest.session_id = i.session_id
              AND latest.word_id = i.word_id
              AND latest.practice_kind = ?
              AND latest.phase = 'word'
          )
        WHERE i.session_id = ?
        ORDER BY i.item_no
      `
      )
      .all(session.practice_kind, sessionId) as Array<{
      item_no: number;
      word_id: string;
      score: number | null;
      level: string | null;
      error_summary: string | null;
    }>;
    const summaryItems = items.map((item) => ({
      itemNo: item.item_no,
      wordId: item.word_id,
      score: item.score === null || item.score === undefined ? null : Number(item.score),
      level: item.level,
      errorSummary: item.error_summary
    }));
    const submitted = summaryItems.filter((item) => item.score !== null);
    const averageScore = submitted.length
      ? submitted.reduce((sum, item) => sum + Number(item.score), 0) / submitted.length
      : null;
    return {
      session,
      items: summaryItems,
      averageScore,
      submittedCount: submitted.length,
      errorCount: summaryItems.filter((item) => item.errorSummary).length
    };
  }

  // 本次会话所有提交（中考含单词阶段+例句阶段，高考仅单词阶段）的展示平均分。
  private computeWordSessionAverage(sessionId: number): number | null {
    const row = this.db
      .prepare("SELECT ROUND(AVG(score)) AS avg FROM word_submissions WHERE session_id = ?")
      .get(sessionId) as { avg: number | null };
    return row.avg === null ? null : Number(row.avg);
  }

  // 按关卡聚合：完成次数 + 历史最高均分（MAX 自动跳过早期未记分的 null 会话）。
  wordLevelAttemptStats(practiceKind: WordPracticeKind = "junior"): Map<string, { attemptCount: number; bestAverageScore: number | null }> {
    const rows = this.db
      .prepare(
        `
        SELECT level_id,
          COUNT(*) AS attempt_count,
          MAX(average_score) AS best_average_score
        FROM word_sessions
        WHERE practice_kind = ? AND status = 'completed' AND level_id IS NOT NULL AND mode = 'level'
        GROUP BY level_id
      `
      )
      .all(practiceKind) as Array<{ level_id: string; attempt_count: number; best_average_score: number | null }>;
    const result = new Map<string, { attemptCount: number; bestAverageScore: number | null }>();
    for (const row of rows) {
      result.set(row.level_id, {
        attemptCount: row.attempt_count,
        bestAverageScore: row.best_average_score
      });
    }
    return result;
  }

  masteredWordIds(threshold: number, practiceKind: WordPracticeKind = "junior"): Set<string> {
    if (practiceKind === "senior") {
      const rows = this.db
        .prepare(`
          WITH latest AS (
            SELECT ws.word_id, ws.score
            FROM word_submissions ws
            INNER JOIN (
              SELECT word_id, MAX(id) AS id
              FROM word_submissions
              WHERE practice_kind = 'senior' AND phase = 'word'
              GROUP BY word_id
            ) latest ON latest.id = ws.id
          )
          SELECT word_id
          FROM latest
          WHERE score >= ?
        `)
        .all(threshold) as Array<{ word_id: string }>;
      return new Set(rows.map((row) => row.word_id));
    }
    const rows = this.db
      .prepare(`
        WITH latest AS (
          SELECT ws.word_id, ws.phase, ws.score
          FROM word_submissions ws
          INNER JOIN (
            SELECT word_id, phase, MAX(id) AS id
            FROM word_submissions
            WHERE practice_kind = 'junior'
            GROUP BY word_id, phase
          ) latest ON latest.id = ws.id
        )
        SELECT word.word_id
        FROM latest word
        INNER JOIN latest example ON example.word_id = word.word_id AND example.phase = 'example'
        WHERE word.phase = 'word' AND word.score >= ? AND example.score >= ?
      `)
      .all(threshold, threshold) as Array<{ word_id: string }>;
    return new Set(rows.map((row) => row.word_id));
  }

  practicedWordIds(practiceKind: WordPracticeKind = "junior"): Set<string> {
    const rows = this.db
      .prepare("SELECT DISTINCT word_id FROM word_submissions WHERE practice_kind = ?")
      .all(practiceKind) as Array<{ word_id: string }>;
    return new Set(rows.map((row) => row.word_id));
  }

  latestWordReviewRows(threshold: number, practiceKind: WordPracticeKind = "junior"): WordReviewRow[] {
    return this.db
      .prepare(`
        WITH latest AS (
          SELECT ws.word_id, ws.phase, ws.score, ws.issues_json, ws.created_at
          FROM word_submissions ws
          INNER JOIN (
            SELECT word_id, phase, MAX(id) AS id
            FROM word_submissions
            WHERE practice_kind = ?
              ${practiceKind === "senior" ? "AND phase = 'word'" : ""}
            GROUP BY word_id, phase
          ) latest ON latest.id = ws.id
        ),
        failing AS (
          SELECT *
          FROM latest
          WHERE score < ?
        ),
        ranked AS (
          SELECT
            word_id,
            phase AS latest_phase,
            score AS latest_score,
            issues_json AS latest_issues_json,
            created_at AS latest_at,
            ROW_NUMBER() OVER (PARTITION BY word_id ORDER BY datetime(created_at) DESC) AS rank
          FROM failing
        )
        SELECT word_id, latest_phase, latest_score, latest_issues_json, latest_at
        FROM ranked
        WHERE rank = 1
        ORDER BY latest_score ASC, datetime(latest_at) ASC
      `)
      .all(practiceKind, threshold) as WordReviewRow[];
  }

  getWordProgress(totalWords: number, threshold: number, wordIds?: string[], practiceKind: WordPracticeKind = "junior"): WordProgressStats {
    const scope = scopedWordClause(practiceKind, wordIds);
    const practicedRow = this.db
      .prepare(`SELECT COUNT(DISTINCT word_id) AS count FROM word_submissions${scope.where}`)
      .get(...scope.params) as { count: number };
    const sessionRow = this.db.prepare("SELECT COUNT(*) AS count FROM word_sessions WHERE practice_kind = ?").get(practiceKind) as { count: number };
    const submissionRow = this.db
      .prepare(`SELECT COUNT(*) AS count FROM word_submissions${scope.where}`)
      .get(...scope.params) as { count: number };
    const scopedIds = wordIds ? new Set(wordIds) : null;
    const mastered = this.masteredWordIds(threshold, practiceKind);
    const reviewRows = this.latestWordReviewRows(threshold, practiceKind);
    return {
      totalWords,
      practicedWords: practicedRow.count,
      masteredWords: scopedIds ? [...mastered].filter((wordId) => scopedIds.has(wordId)).length : mastered.size,
      reviewWords: scopedIds ? reviewRows.filter((row) => scopedIds.has(row.word_id)).length : reviewRows.length,
      sessionCount: sessionRow.count,
      submissionCount: submissionRow.count
    };
  }

  getActivityCalendar(year: number, today = shanghaiDateString(new Date())): ActivityCalendar {
    const startDate = `${year}-01-01`;
    const endDate = `${year + 1}-01-01`;
    const startTimestamp = shanghaiDateStartUtcTimestamp(startDate);
    const endTimestamp = shanghaiDateStartUtcTimestamp(endDate);
    const days = new Map<string, ActivityCalendarDay>();
    for (const date of datesInYear(year)) {
      days.set(date, {
        date,
        completed: false,
        sentence: emptyActivitySummary("中译英未做"),
        juniorWord: emptyActivitySummary("中考词汇未练"),
        seniorWord: emptyActivitySummary("高考词汇未练"),
        word: emptyActivitySummary("单词未练"),
        events: []
      });
    }

    const sentenceCompletions = this.db
      .prepare(
        `
        SELECT
          date(datetime(completed_at, '+8 hours')) AS activity_date,
          season,
          day,
          question_count,
          average_score,
          completed_at
        FROM day_attempts
        WHERE status = 'completed'
          AND completed_at IS NOT NULL
          AND completed_at >= ?
          AND completed_at < ?
        ORDER BY datetime(completed_at) ASC, id ASC
      `
      )
      .all(startTimestamp, endTimestamp) as Array<{
      activity_date: string;
      season: number;
      day: number;
      question_count: number;
      average_score: number | null;
      completed_at: string;
    }>;

    const sentenceSubmissions = this.db
      .prepare(
        `
        SELECT
          date(datetime(created_at, '+8 hours')) AS activity_date,
          COUNT(*) AS submission_count,
          COUNT(DISTINCT question_id) AS question_count,
          ROUND(AVG(score)) AS average_score,
          MAX(created_at) AS latest_at
        FROM submissions
        WHERE created_at >= ?
          AND created_at < ?
        GROUP BY activity_date
      `
      )
      .all(startTimestamp, endTimestamp) as Array<{
      activity_date: string;
      submission_count: number;
      question_count: number;
      average_score: number | null;
      latest_at: string | null;
    }>;

    const wordCompletions = this.db
      .prepare(
        `
        SELECT
          date(datetime(completed_at, '+8 hours')) AS activity_date,
          practice_kind,
          mode,
          level_id,
          word_count,
          average_score,
          completed_at
        FROM word_sessions
        WHERE status = 'completed'
          AND completed_at IS NOT NULL
          AND completed_at >= ?
          AND completed_at < ?
        ORDER BY datetime(completed_at) ASC, id ASC
      `
      )
      .all(startTimestamp, endTimestamp) as Array<{
      activity_date: string;
      practice_kind: WordPracticeKind;
      mode: string;
      level_id: string | null;
      word_count: number;
      average_score: number | null;
      completed_at: string;
    }>;

    const wordSubmissions = this.db
      .prepare(
        `
        SELECT
          date(datetime(created_at, '+8 hours')) AS activity_date,
          practice_kind,
          COUNT(*) AS submission_count,
          COUNT(DISTINCT word_id) AS word_count,
          ROUND(AVG(score)) AS average_score,
          MAX(created_at) AS latest_at
        FROM word_submissions
        WHERE created_at >= ?
          AND created_at < ?
        GROUP BY activity_date, practice_kind
      `
      )
      .all(startTimestamp, endTimestamp) as Array<{
      activity_date: string;
      practice_kind: WordPracticeKind;
      submission_count: number;
      word_count: number;
      average_score: number | null;
      latest_at: string | null;
    }>;

    const sentenceSubmissionsByDate = new Map(sentenceSubmissions.map((row) => [row.activity_date, row]));
    const wordSubmissionsByDate = new Map(wordSubmissions.map((row) => [row.activity_date, row]));
    const sentenceCompletionCounts = new Map<string, number>();
    const wordCompletionCounts = new Map<string, number>();

    for (const row of sentenceCompletions) {
      const day = days.get(row.activity_date);
      if (!day) continue;
      const count = (sentenceCompletionCounts.get(row.activity_date) || 0) + 1;
      sentenceCompletionCounts.set(row.activity_date, count);
      day.completed = true;
      day.sentence = {
        status: "complete",
        label: count > 1 ? `中译英完成 ${count} 次` : "中译英完成",
        score: row.average_score,
        count,
        time: shanghaiTime(row.completed_at)
      };
      day.events.push({
        type: "sentence",
        label: `中译英 S${row.season} Day ${row.day}`,
        detail: `完成 ${scoreText(row.average_score)} · ${row.question_count} 题`,
        score: row.average_score,
        time: shanghaiTime(row.completed_at),
        occurredAt: row.completed_at
      });
    }

    for (const row of sentenceSubmissions) {
      const day = days.get(row.activity_date);
      if (!day) continue;
      day.completed = true;
      if (day.sentence.status === "none") {
        day.sentence = {
          status: "partial",
          label: `中译英 ${row.question_count} 题`,
          score: row.average_score,
          count: row.question_count,
          time: row.latest_at ? shanghaiTime(row.latest_at) : null
        };
        day.events.push({
          type: "sentence",
          label: "中译英",
          detail: `已做 ${row.question_count} 题 · 均分 ${scoreText(row.average_score)}`,
          score: row.average_score,
          time: row.latest_at ? shanghaiTime(row.latest_at) : null,
          occurredAt: row.latest_at
        });
      }
    }

    for (const row of wordCompletions) {
      const day = days.get(row.activity_date);
      if (!day) continue;
      const summaryKey = wordSummaryKey(row.practice_kind);
      const countKey = `${row.activity_date}:${row.practice_kind}`;
      const count = (wordCompletionCounts.get(countKey) || 0) + 1;
      wordCompletionCounts.set(countKey, count);
      const label = wordPracticeLabel(row.practice_kind);
      day.completed = true;
      day[summaryKey] = {
        status: "complete",
        label: count > 1 ? `${label}完成 ${count} 次` : `${label}完成`,
        score: row.average_score,
        count,
        time: shanghaiTime(row.completed_at)
      };
      day.events.push({
        type: "word",
        practiceKind: row.practice_kind,
        label,
        detail: `${wordSessionLabel(row.mode, row.level_id)} · ${row.word_count} 词 · ${scoreText(row.average_score)}`,
        score: row.average_score,
        time: shanghaiTime(row.completed_at),
        occurredAt: row.completed_at
      });
    }

    for (const row of wordSubmissions) {
      const day = days.get(row.activity_date);
      if (!day) continue;
      day.completed = true;
      const summaryKey = wordSummaryKey(row.practice_kind);
      if (day[summaryKey].status === "none") {
        const label = wordPracticeLabel(row.practice_kind);
        day[summaryKey] = {
          status: "partial",
          label: `${label} ${row.word_count} 个`,
          score: row.average_score,
          count: row.word_count,
          time: row.latest_at ? shanghaiTime(row.latest_at) : null
        };
        day.events.push({
          type: "word",
          practiceKind: row.practice_kind,
          label,
          detail: `已练 ${row.word_count} 个词 · 均分 ${scoreText(row.average_score)}`,
          score: row.average_score,
          time: row.latest_at ? shanghaiTime(row.latest_at) : null,
          occurredAt: row.latest_at
        });
      }
    }

    for (const day of days.values()) {
      day.word = combineWordActivitySummary(day.juniorWord, day.seniorWord);
      day.events.sort((a, b) => String(a.occurredAt || "").localeCompare(String(b.occurredAt || "")));
    }

    const averageRow = this.db
      .prepare(
        `
        SELECT ROUND(AVG(score)) AS average_score, COUNT(*) AS practice_count
        FROM (
          SELECT score FROM submissions WHERE created_at >= ? AND created_at < ?
          UNION ALL
          SELECT score FROM word_submissions WHERE created_at >= ? AND created_at < ?
        )
      `
      )
      .get(startTimestamp, endTimestamp, startTimestamp, endTimestamp) as { average_score: number | null; practice_count: number };

    const orderedDays = [...days.values()];
    const anchorDate = activityAnchorDate(year, today);
    return {
      year,
      today,
      summary: {
        currentStreak: computeCurrentStreak(orderedDays, today),
        longestStreak: computeLongestStreak(orderedDays, anchorDate),
        completedDays: orderedDays.filter((day) => day.completed).length,
        totalPracticeCount: averageRow.practice_count,
        averageScore: averageRow.average_score === null ? null : Number(averageRow.average_score)
      },
      days: orderedDays
    };
  }

  // --- 钱包(Wallet):满分奖励 / 低分惩罚流水、提现、家长配置 ---

  getWalletSettings(): WalletSettings {
    const rows = this.db.prepare("SELECT key, value, updated_at FROM wallet_settings").all() as Array<{
      key: string;
      value: string;
      updated_at: string;
    }>;
    const values = new Map(rows.map((row) => [row.key, row.value]));
    const updatedAt =
      rows.reduce<string | null>((latest, row) => {
        if (!latest || row.updated_at > latest) return row.updated_at;
        return latest;
      }, null) || null;
    return {
      rewardScore: scoreSetting(values.get("reward_score"), WALLET_DEFAULTS.rewardScore),
      rewardMinCents: centsSetting(values.get("reward_min_cents"), WALLET_DEFAULTS.rewardMinCents),
      rewardMaxCents: centsSetting(values.get("reward_max_cents"), WALLET_DEFAULTS.rewardMaxCents),
      penaltyScoreBelow: scoreSetting(values.get("penalty_score_below"), WALLET_DEFAULTS.penaltyScoreBelow),
      penaltyMinCents: centsSetting(values.get("penalty_min_cents"), WALLET_DEFAULTS.penaltyMinCents),
      penaltyMaxCents: centsSetting(values.get("penalty_max_cents"), WALLET_DEFAULTS.penaltyMaxCents),
      withdrawThresholdCents: centsSetting(values.get("withdraw_threshold_cents"), WALLET_DEFAULTS.withdrawThresholdCents),
      seniorWordRewardAverageAbove: scoreSetting(values.get("senior_word_reward_average_above"), WALLET_DEFAULTS.seniorWordRewardAverageAbove),
      seniorWordPenaltyAverageBelow: scoreSetting(values.get("senior_word_penalty_average_below"), WALLET_DEFAULTS.seniorWordPenaltyAverageBelow),
      updatedAt
    };
  }

  updateWalletSettings(input: Partial<Omit<WalletSettings, "updatedAt">>): WalletSettings {
    const current = this.getWalletSettings();
    const next = {
      rewardScore: input.rewardScore ?? current.rewardScore,
      rewardMinCents: input.rewardMinCents ?? current.rewardMinCents,
      rewardMaxCents: input.rewardMaxCents ?? current.rewardMaxCents,
      penaltyScoreBelow: input.penaltyScoreBelow ?? current.penaltyScoreBelow,
      penaltyMinCents: input.penaltyMinCents ?? current.penaltyMinCents,
      penaltyMaxCents: input.penaltyMaxCents ?? current.penaltyMaxCents,
      withdrawThresholdCents: input.withdrawThresholdCents ?? current.withdrawThresholdCents,
      seniorWordRewardAverageAbove: input.seniorWordRewardAverageAbove ?? current.seniorWordRewardAverageAbove,
      seniorWordPenaltyAverageBelow: input.seniorWordPenaltyAverageBelow ?? current.seniorWordPenaltyAverageBelow
    };
    if (!Number.isInteger(next.rewardScore) || next.rewardScore < 1 || next.rewardScore > 100) {
      throw new Error("奖励触发分数需为 1~100 之间的整数。");
    }
    if (!Number.isInteger(next.penaltyScoreBelow) || next.penaltyScoreBelow < 0 || next.penaltyScoreBelow > 100) {
      throw new Error("扣除触发分数需为 0~100 之间的整数。");
    }
    if (!Number.isInteger(next.seniorWordRewardAverageAbove) || next.seniorWordRewardAverageAbove < 0 || next.seniorWordRewardAverageAbove > 100) {
      throw new Error("高考词汇奖励平均分需为 0~100 之间的整数。");
    }
    if (!Number.isInteger(next.seniorWordPenaltyAverageBelow) || next.seniorWordPenaltyAverageBelow < 0 || next.seniorWordPenaltyAverageBelow > 100) {
      throw new Error("高考词汇扣除平均分需为 0~100 之间的整数。");
    }
    if (next.rewardScore < next.penaltyScoreBelow) {
      throw new Error("奖励触发分数不能低于扣除触发分数。");
    }
    if (next.seniorWordRewardAverageAbove <= next.seniorWordPenaltyAverageBelow) {
      throw new Error("高考词汇奖励平均分必须高于扣除平均分。");
    }
    const fields: Array<[string, number, number]> = [
      ["奖励金额", next.rewardMinCents, 10000],
      ["奖励金额", next.rewardMaxCents, 10000],
      ["扣除金额", next.penaltyMinCents, 10000],
      ["扣除金额", next.penaltyMaxCents, 10000],
      ["提现门槛", next.withdrawThresholdCents, 1000000]
    ];
    for (const [label, value, maxCents] of fields) {
      if (!Number.isInteger(value) || value % 100 !== 0 || value < 100 || value > maxCents) {
        throw new Error(`${label}需为 1~${maxCents / 100} 之间的整数元。`);
      }
    }
    if (next.rewardMinCents > next.rewardMaxCents) throw new Error("奖励金额下限不能大于上限。");
    if (next.penaltyMinCents > next.penaltyMaxCents) throw new Error("扣除金额下限不能大于上限。");
    this.db.exec("BEGIN");
    try {
      const upsert = this.db.prepare(`
        INSERT INTO wallet_settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
      `);
      upsert.run("reward_score", String(next.rewardScore));
      upsert.run("reward_min_cents", String(next.rewardMinCents));
      upsert.run("reward_max_cents", String(next.rewardMaxCents));
      upsert.run("penalty_score_below", String(next.penaltyScoreBelow));
      upsert.run("penalty_min_cents", String(next.penaltyMinCents));
      upsert.run("penalty_max_cents", String(next.penaltyMaxCents));
      upsert.run("withdraw_threshold_cents", String(next.withdrawThresholdCents));
      upsert.run("senior_word_reward_average_above", String(next.seniorWordRewardAverageAbove));
      upsert.run("senior_word_penalty_average_below", String(next.seniorWordPenaltyAverageBelow));
      this.db.exec("COMMIT");
      return this.getWalletSettings();
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  getWalletBalance(): number {
    const row = this.db.prepare("SELECT COALESCE(SUM(amount_cents), 0) AS balance FROM wallet_transactions").get() as {
      balance: number;
    };
    return Number(row.balance);
  }

  // 结算一次提交的奖惩。自己开事务,严禁在其他事务内调用(目前两个提交路由都在事务外调)。
  settleSubmissionWallet(input: WalletSettleInput): WalletChange {
    // AI 评分失败(errorSummary 非空)不奖不罚——失败的是评分,不是孩子。
    if (input.errorSummary) {
      return { change: 0, balance: this.getWalletBalance(), reason: null };
    }
    if (input.source === "word" && normalizePracticeKind(input.practiceKind) === "senior") {
      return { change: 0, balance: this.getWalletBalance(), reason: null };
    }
    const refId = input.source === "sentence" ? input.questionId : `${input.wordId}:${input.phase}`;
    const settings = this.getWalletSettings();
    this.db.exec("BEGIN");
    try {
      let change = 0;
      let reason: WalletChange["reason"] = null;
      if (input.score >= settings.rewardScore) {
        // 每个 ref(题目 / 单词+阶段)历史上只奖一次,复习时首次拿到满分同样算。
        const rewarded = this.db
          .prepare("SELECT 1 FROM wallet_transactions WHERE type = 'reward' AND source = ? AND ref_id = ? LIMIT 1")
          .get(input.source, refId);
        if (!rewarded) {
          change = randomWholeYuanCents(settings.rewardMinCents, settings.rewardMaxCents);
          reason = "perfect";
        }
      } else if (input.score < settings.penaltyScoreBelow) {
        // 仅该 ref 的首次有效提交才扣钱(本行已入库,所以"首次"即 COUNT = 1)。
        // error_summary IS NULL 是故意的:首次提交若是 AI 失败,不消耗惩罚判定名额。
        // 复习模式天然不会触发惩罚——复习提交必然不是首次。
        const row = (input.source === "sentence"
          ? this.db
              .prepare("SELECT COUNT(*) AS n FROM submissions WHERE question_id = ? AND error_summary IS NULL")
              .get(input.questionId)
          : this.db
              .prepare("SELECT COUNT(*) AS n FROM word_submissions WHERE word_id = ? AND phase = ? AND error_summary IS NULL")
              .get(input.wordId, input.phase)) as { n: number };
        if (row.n === 1) {
          change = -randomWholeYuanCents(settings.penaltyMinCents, settings.penaltyMaxCents);
          reason = "fail";
        }
      }
      if (change !== 0) {
        this.db
          .prepare(`
            INSERT INTO wallet_transactions (type, amount_cents, source, ref_id, submission_id, score)
            VALUES (?, ?, ?, ?, ?, ?)
          `)
          .run(change > 0 ? "reward" : "penalty", change, input.source, refId, input.submissionId, input.score);
      }
      this.db.exec("COMMIT");
      return { change, balance: this.getWalletBalance(), reason };
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  settleSeniorWordSessionWallet(sessionId: number): WalletChange {
    const settings = this.getWalletSettings();
    const summary = this.getWordSessionSummary(sessionId);
    if (!summary) {
      return { change: 0, balance: this.getWalletBalance(), reason: null };
    }
    const session = summary.session;
    if (session.practice_kind !== "senior" || session.status !== "completed" || session.mode === "review") {
      return { change: 0, balance: this.getWalletBalance(), reason: null };
    }

    if (summary.averageScore === null || summary.submittedCount < session.word_count || summary.errorCount > 0) {
      return { change: 0, balance: this.getWalletBalance(), reason: null };
    }

    const averageScore = Number(summary.averageScore);
    let change = 0;
    let reason: WalletChange["reason"] = null;
    if (averageScore >= settings.seniorWordRewardAverageAbove) {
      change = randomWholeYuanCents(settings.rewardMinCents, settings.rewardMaxCents);
      reason = "perfect";
    } else if (averageScore < settings.seniorWordPenaltyAverageBelow) {
      change = -randomWholeYuanCents(settings.penaltyMinCents, settings.penaltyMaxCents);
      reason = "fail";
    }
    if (change === 0) return { change: 0, balance: this.getWalletBalance(), reason: null };

    const refId = seniorWordSessionRefId(session, this.getWordSessionWordIds(sessionId));
    this.db.exec("BEGIN");
    try {
      const settled = this.db
        .prepare("SELECT 1 FROM wallet_transactions WHERE source = 'senior-word-session' AND ref_id = ? AND type IN ('reward', 'penalty') LIMIT 1")
        .get(refId);
      if (!settled) {
        this.db
          .prepare(
            `
            INSERT INTO wallet_transactions (type, amount_cents, source, ref_id, submission_id, score, note)
            VALUES (?, ?, 'senior-word-session', ?, NULL, ?, ?)
          `
          )
          .run(change > 0 ? "reward" : "penalty", change, refId, Math.round(averageScore), "高考词汇整组平均分结算");
      } else {
        change = 0;
        reason = null;
      }
      this.db.exec("COMMIT");
      return { change, balance: this.getWalletBalance(), reason };
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  createWithdrawal(): { id: number; amountCents: number; balance: number } {
    const threshold = this.getWalletSettings().withdrawThresholdCents;
    this.db.exec("BEGIN");
    try {
      const balance = this.getWalletBalance();
      if (balance < threshold) {
        throw new Error(`余额还差 ${yuanText(threshold - balance)} 才能提现。`);
      }
      const result = this.db
        .prepare("INSERT INTO wallet_transactions (type, amount_cents, status) VALUES ('withdraw', ?, 'pending')")
        .run(-balance);
      this.db.exec("COMMIT");
      return { id: Number(result.lastInsertRowid), amountCents: balance, balance: 0 };
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  markWithdrawalPaid(id: number): boolean {
    const result = this.db
      .prepare(
        "UPDATE wallet_transactions SET status = 'paid', paid_at = CURRENT_TIMESTAMP WHERE id = ? AND type = 'withdraw' AND status = 'pending'"
      )
      .run(id);
    return Number(result.changes) > 0;
  }

  adjustWallet(amountCents: number, note: string): { id: number; balance: number } {
    const trimmed = (note || "").trim();
    if (!Number.isInteger(amountCents) || amountCents === 0) throw new Error("调整金额需为非零整数。");
    if (Math.abs(amountCents) > 100000) throw new Error("单次调整金额不能超过 ¥1000。");
    if (!trimmed) throw new Error("请填写调整原因。");
    const result = this.db
      .prepare("INSERT INTO wallet_transactions (type, amount_cents, note) VALUES ('adjust', ?, ?)")
      .run(amountCents, trimmed);
    return { id: Number(result.lastInsertRowid), balance: this.getWalletBalance() };
  }

  walletTransactions(limit: number, offset: number, type?: string): { total: number; items: WalletTransactionRow[] } {
    const where = type ? " WHERE type = ?" : "";
    const params: Array<string | number> = type ? [type] : [];
    const totalRow = this.db.prepare(`SELECT COUNT(*) AS n FROM wallet_transactions${where}`).get(...params) as { n: number };
    const items = this.db
      .prepare(
        `SELECT id, type, amount_cents, source, ref_id, submission_id, score, status, paid_at, note, created_at
         FROM wallet_transactions${where} ORDER BY id DESC LIMIT ? OFFSET ?`
      )
      .all(...params, limit, offset) as WalletTransactionRow[];
    return { total: totalRow.n, items };
  }

  listWithdrawals(): WalletTransactionRow[] {
    return this.db
      .prepare(
        `SELECT id, type, amount_cents, source, ref_id, submission_id, score, status, paid_at, note, created_at
         FROM wallet_transactions WHERE type = 'withdraw' ORDER BY id DESC`
      )
      .all() as WalletTransactionRow[];
  }
}

function scopedWordClause(practiceKind: WordPracticeKind, wordIds?: string[]): { where: string; params: string[] } {
  if (!wordIds) return { where: " WHERE practice_kind = ?", params: [practiceKind] };
  if (wordIds.length === 0) return { where: " WHERE 1 = 0", params: [] };
  return {
    where: ` WHERE practice_kind = ? AND word_id IN (${wordIds.map(() => "?").join(",")})`,
    params: [practiceKind, ...wordIds]
  };
}

function parseJsonObject(raw: string): Record<string, string> {
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed).map(([key, value]) => [key, String(value || "")]));
  } catch {
    return {};
  }
}

function wordSubmissionRowToGrade(row: WordSubmissionRow): GradeResult {
  return {
    score: row.score,
    level: row.level,
    encouragement: row.encouragement,
    issues: parseIssues(row.issues_json),
    suggestion: row.suggestion,
    improvedAnswer: row.improved_answer,
    referenceAnswer: row.reference_answer,
    needsReview: Boolean(row.needs_review)
  };
}

function parseIssues(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map((issue) => String(issue)).filter(Boolean) : [];
  } catch {
    return [];
  }
}

const SQLITE_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
const SHANGHAI_OFFSET_MS = 8 * 60 * 60 * 1000;

export function shanghaiDateString(value: Date | string): string {
  const date = typeof value === "string" ? dateFromStoredTimestamp(value) : value;
  return new Date(date.getTime() + SHANGHAI_OFFSET_MS).toISOString().slice(0, 10);
}

function shanghaiTime(value: string): string {
  const shifted = new Date(dateFromStoredTimestamp(value).getTime() + SHANGHAI_OFFSET_MS);
  return shifted.toISOString().slice(11, 16);
}

function shanghaiDateStartUtcTimestamp(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  const utcStart = new Date(Date.UTC(year, month - 1, day) - SHANGHAI_OFFSET_MS);
  return utcStart.toISOString().slice(0, 19).replace("T", " ");
}

function dateFromStoredTimestamp(value: string): Date {
  return new Date(SQLITE_TIMESTAMP_PATTERN.test(value) ? `${value.replace(" ", "T")}Z` : value);
}

function datesInYear(year: number): string[] {
  const dates: string[] = [];
  for (let time = Date.UTC(year, 0, 1); ; time += 24 * 60 * 60 * 1000) {
    const date = new Date(time).toISOString().slice(0, 10);
    if (!date.startsWith(`${year}-`)) break;
    dates.push(date);
  }
  return dates;
}

function addDays(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

function emptyActivitySummary(label: string): ActivityPracticeSummary {
  return { status: "none", label, score: null, count: 0, time: null };
}

function scoreText(score: number | null): string {
  return score === null ? "--分" : `${score}分`;
}

function wordSessionLabel(mode: string, levelId: string | null): string {
  if (mode === "review") return "复习";
  if (levelId) return `关卡 ${levelId.toUpperCase()}`;
  return "自由练习";
}

function wordPracticeLabel(practiceKind: WordPracticeKind): string {
  return practiceKind === "senior" ? "高考词汇练习" : "中考词汇练习";
}

function wordSummaryKey(practiceKind: WordPracticeKind): "juniorWord" | "seniorWord" {
  return practiceKind === "senior" ? "seniorWord" : "juniorWord";
}

function combineWordActivitySummary(juniorWord: ActivityPracticeSummary, seniorWord: ActivityPracticeSummary): ActivityPracticeSummary {
  const active = [juniorWord, seniorWord].filter((summary) => summary.status !== "none");
  if (active.length === 0) return emptyActivitySummary("单词未练");
  if (active.length === 1) return active[0];
  const scores = active.map((summary) => summary.score).filter((score): score is number => score !== null);
  const completeCount = active.filter((summary) => summary.status === "complete").length;
  return {
    status: completeCount === active.length ? "complete" : "partial",
    label: completeCount === active.length ? "词汇完成 2 项" : "词汇已练 2 项",
    score: scores.length ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : null,
    count: active.reduce((sum, summary) => sum + summary.count, 0),
    time: active.reduce<string | null>((latest, summary) => {
      if (!summary.time) return latest;
      return !latest || summary.time > latest ? summary.time : latest;
    }, null)
  };
}

function activityAnchorDate(year: number, today: string): string | null {
  const todayYear = Number(today.slice(0, 4));
  if (todayYear < year) return null;
  if (todayYear === year) return today;
  return `${year}-12-31`;
}

function computeCurrentStreak(days: ActivityCalendarDay[], today: string): number {
  const byDate = new Map(days.map((day) => [day.date, day]));
  if (!byDate.has(today)) return 0;
  let count = 0;
  for (let date = today; byDate.has(date); date = addDays(date, -1)) {
    if (!byDate.get(date)?.completed) break;
    count += 1;
  }
  return count;
}

function computeLongestStreak(days: ActivityCalendarDay[], anchorDate: string | null): number {
  let current = 0;
  let longest = 0;
  for (const day of days) {
    if (anchorDate && day.date > anchorDate) break;
    if (day.completed) {
      current += 1;
      longest = Math.max(longest, current);
    } else {
      current = 0;
    }
  }
  return longest;
}

export function computeDayProgress(latestRows: SubmissionRow[], dayQuestionCounts: Map<string, number>, reviewThreshold = 80) {
  const byDay = new Map<string, { questionIds: Set<string>; scores: number[]; needsReview: boolean }>();

  for (const row of latestRows) {
    const key = `${row.season}:${row.day}`;
    const progress = byDay.get(key) || { questionIds: new Set<string>(), scores: [], needsReview: false };
    progress.questionIds.add(row.question_id);
    progress.scores.push(row.score);
    progress.needsReview ||= row.score < reviewThreshold;
    byDay.set(key, progress);
  }

  const result = new Map<string, DayProgress>();
  for (const [key, questionCount] of dayQuestionCounts) {
    const progress = byDay.get(key);
    const submitted = progress?.questionIds.size || 0;
    const bestAverage =
      progress && progress.scores.length > 0
        ? Math.round(progress.scores.reduce((sum, score) => sum + score, 0) / progress.scores.length)
        : null;
    result.set(key, {
      submitted,
      completed: submitted >= questionCount,
      needsReview: progress?.needsReview || false,
      bestAverage
    });
  }
  return result;
}

function stringSetting(value: string | undefined, fallback: string | undefined): string | undefined {
  const text = value === undefined ? fallback : value;
  return text && text.trim() ? text.trim() : undefined;
}

function numberSetting(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(Math.max(Math.round(parsed), 1000), 120000);
}

function ttsProviderSetting(value?: string, fallback?: string): TtsProvider {
  const provider = (value || fallback || "volcengine").trim();
  return provider === "openai-compatible" ? "openai-compatible" : "volcengine";
}

function defaultTtsBaseUrl(provider: TtsProvider): string {
  return provider === "openai-compatible"
    ? "https://api.openai.com"
    : "https://openspeech.bytedance.com/api/v3/tts/unidirectional";
}

const WALLET_DEFAULTS = {
  rewardScore: 100,
  rewardMinCents: 100,
  rewardMaxCents: 300,
  penaltyScoreBelow: 60,
  penaltyMinCents: 100,
  penaltyMaxCents: 200,
  withdrawThresholdCents: 1000,
  seniorWordRewardAverageAbove: 90,
  seniorWordPenaltyAverageBelow: 70
};

function normalizePracticeKind(value: unknown): WordPracticeKind {
  return value === "senior" ? "senior" : "junior";
}

function wordBatchSizeKey(practiceKind: WordPracticeKind): string {
  return practiceKind === "senior" ? "senior_batch_size" : "batch_size";
}

function defaultWordBatchSize(practiceKind: WordPracticeKind): number {
  return practiceKind === "senior" ? 10 : 5;
}

function seniorWordSessionRefId(session: WordSessionRow, wordIds: string[]): string {
  const groupId = session.level_id || "free";
  return `${session.practice_kind}:${session.scope_tag}:${session.mode}:${groupId}:${wordIds.join(",")}`;
}

// 钱包金额配置:整数分、整元(100 的倍数)、至少 1 元,否则回退默认值。
function centsSetting(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 100 || parsed % 100 !== 0) return fallback;
  return parsed;
}

function scoreSetting(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 100) return fallback;
  return parsed;
}

// 在 [min, max] 分之间按整元随机(min == max 时退化为定值,测试用)。
function randomWholeYuanCents(minCents: number, maxCents: number): number {
  const minYuan = Math.round(minCents / 100);
  const maxYuan = Math.max(minYuan, Math.round(maxCents / 100));
  return (minYuan + Math.floor(Math.random() * (maxYuan - minYuan + 1))) * 100;
}

function yuanText(cents: number): string {
  return cents % 100 === 0 ? `¥${cents / 100}` : `¥${(cents / 100).toFixed(2)}`;
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function clampWordBatchSize(value: number, fallback = 5): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(1, Math.min(30, Math.round(value)));
}
