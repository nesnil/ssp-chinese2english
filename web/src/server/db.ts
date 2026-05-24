import { mkdirSync } from "node:fs";
import path from "node:path";
import { createHash, randomBytes } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import type { AppConfig, GradeResult } from "./types.js";

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
    `);
    this.addColumnIfMissing("submissions", "attempt_id", "INTEGER");
    this.addColumnIfMissing("submissions", "mode", "TEXT NOT NULL DEFAULT 'day'");
    this.db.exec("CREATE INDEX IF NOT EXISTS idx_submissions_attempt ON submissions(attempt_id, mode, question_no);");
  }

  private addColumnIfMissing(table: string, column: string, definition: string) {
    const rows = this.db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
    if (!rows.some((row) => row.name === column)) {
      this.db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition};`);
    }
  }

  createSession(): string {
    const token = randomBytes(32).toString("base64url");
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString();
    this.db.prepare("INSERT INTO app_sessions (token_hash, expires_at) VALUES (?, ?)").run(tokenHash, expiresAt);
    return token;
  }

  hasSession(token: string): boolean {
    const tokenHash = hashToken(token);
    const row = this.db
      .prepare("SELECT id FROM app_sessions WHERE token_hash = ? AND datetime(expires_at) > CURRENT_TIMESTAMP")
      .get(tokenHash);
    return Boolean(row);
  }

  deleteSession(token: string): void {
    this.db.prepare("DELETE FROM app_sessions WHERE token_hash = ?").run(hashToken(token));
  }

  pruneSessions(): void {
    this.db.prepare("DELETE FROM app_sessions WHERE datetime(expires_at) <= CURRENT_TIMESTAMP").run();
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
  }): void {
    this.db
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
  }

  startDayAttempt(season: number, day: number, questionCount: number): number {
    const result = this.db
      .prepare("INSERT INTO day_attempts (season, day, question_count, status) VALUES (?, ?, ?, 'in_progress')")
      .run(season, day, questionCount);
    return Number(result.lastInsertRowid);
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

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
