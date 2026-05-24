import crypto from "node:crypto";
import express, { type NextFunction, type Request, type Response } from "express";
import { loadConfig, publicDir } from "./config.js";
import { AppDatabase, computeDayProgress } from "./db.js";
import { AiConfigError, gradeAnswer } from "./grader.js";
import { getBank, getDayQuestions, getQuestion, toPublicQuestion } from "./questionBank.js";

const config = loadConfig();
const database = new AppDatabase(config);
database.pruneSessions();
database.backfillLegacyDayAttempts(getDayQuestionCounts());

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "64kb" }));

const authCookieName = "c2e_session";

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    database: true,
    aiConfigured: Boolean(config.deepseekBaseUrl && config.deepseekApiKey && config.deepseekModel),
    authConfigured: Boolean(config.appPassword && config.sessionSecret),
    questionBank: {
      totalDays: getBank().totalDays,
      totalQuestions: getBank().totalQuestions,
      generatedAt: getBank().generatedAt
    }
  });
});

app.post("/api/login", (req, res) => {
  if (!config.appPassword || !config.sessionSecret) {
    res.status(503).json({ error: "APP_PASSWORD 或 SESSION_SECRET 未配置。" });
    return;
  }

  const password = String(req.body?.password || "");
  const ok = timingSafeEqual(password, config.appPassword);
  if (!ok) {
    res.status(401).json({ error: "口令不正确。" });
    return;
  }

  const token = database.createSession();
  res.cookie(authCookieName, signToken(token, config.sessionSecret), {
    httpOnly: true,
    sameSite: "lax",
    secure: config.nodeEnv === "production",
    maxAge: 1000 * 60 * 60 * 24 * 30,
    path: "/"
  });
  res.json({ ok: true });
});

app.post("/api/logout", requireAuth, (req, res) => {
  const token = readSessionToken(req);
  if (token) database.deleteSession(token);
  res.clearCookie(authCookieName, { path: "/" });
  res.json({ ok: true });
});

app.get("/api/catalog", requireAuth, (_req, res) => {
  const bank = getBank();
  const dayQuestionCounts = getDayQuestionCounts();
  const progress = computeDayProgress(database.latestSubmissions(), dayQuestionCounts, config.reviewScoreThreshold);
  const attemptStats = database.getDayAttemptStats();

  res.json({
    seasons: bank.seasons.map((season) => ({
      season: season.season,
      title: season.title,
      dayCount: season.dayCount,
      questionCount: season.questionCount,
      days: season.days.map((day) => {
        const dayProgress = progress.get(`${season.season}:${day.day}`);
        const stats = attemptStats.get(`${season.season}:${day.day}`);
        return {
          day: day.day,
          questionCount: day.questionCount,
          submitted: dayProgress?.submitted || 0,
          completed: dayProgress?.completed || false,
          needsReview: dayProgress?.needsReview || false,
          bestAverage: dayProgress?.bestAverage ?? null,
          latestAverageScore: stats?.latestAverageScore ?? null,
          attemptCount: stats?.attemptCount || 0,
          lastCompletedAt: stats?.lastCompletedAt ?? null
        };
      })
    }))
  });
});

app.post("/api/day-attempts/start", requireAuth, (req, res) => {
  const season = Number(req.body?.season);
  const day = Number(req.body?.day);
  const questions = getDayQuestions(season, day);
  if (questions.length === 0) {
    res.status(404).json({ error: "没有找到这一天的题目。" });
    return;
  }
  const attemptId = database.startDayAttempt(season, day, questions.length);
  res.json({ attemptId, season, day, questionCount: questions.length });
});

app.get("/api/days/:season/:day/questions", requireAuth, (req, res) => {
  const season = Number(req.params.season);
  const day = Number(req.params.day);
  const questions = getDayQuestions(season, day);
  if (questions.length === 0) {
    res.status(404).json({ error: "没有找到这一天的题目。" });
    return;
  }
  res.json({ season, day, questions: questions.map(toPublicQuestion) });
});

app.get("/api/review", requireAuth, (_req, res) => {
  const reviewRows = database.latestReviewSubmissions(config.reviewScoreThreshold);
  res.json({
    threshold: config.reviewScoreThreshold,
    questions: reviewRows
      .map((row) => {
        const question = getQuestion(row.question_id);
        if (!question) return null;
        return {
          ...toPublicQuestion(question),
          lastScore: row.score,
          lastSubmittedAt: row.created_at,
          lastIssues: parseIssues(row.issues_json)
        };
      })
      .filter(Boolean)
  });
});

app.get("/api/review/history", requireAuth, (_req, res) => {
  const summary = database.getReviewStats(config.reviewScoreThreshold);
  const history = database.reviewHistory(100);
  const attemptsByQuestion = new Map<string, Array<{ score: number; submittedAt: string }>>();
  for (const attempt of history.attempts) {
    const attempts = attemptsByQuestion.get(attempt.question_id) || [];
    attempts.push({ score: attempt.score, submittedAt: attempt.created_at });
    attemptsByQuestion.set(attempt.question_id, attempts);
  }

  res.json({
    threshold: config.reviewScoreThreshold,
    summary,
    questions: history.questions
      .map((row) => {
        const question = getQuestion(row.question_id);
        if (!question) return null;
        return {
          ...toPublicQuestion(question),
          referenceAnswer: question.referenceAnswer,
          reviewCount: row.review_count,
          bestScore: row.best_score,
          latestScore: row.latest_score,
          latestAnswer: row.latest_answer,
          latestIssues: parseIssues(row.latest_issues_json),
          latestReviewAt: row.latest_review_at,
          currentScore: row.current_score,
          attempts: attemptsByQuestion.get(row.question_id) || [],
          latestReviewMastered: row.latest_score >= config.reviewScoreThreshold,
          currentlyNeedsReview: row.current_score < config.reviewScoreThreshold
        };
      })
      .filter(Boolean),
    records: history.records
      .map((row) => {
        const question = getQuestion(row.question_id);
        if (!question) return null;
        return {
          ...toPublicQuestion(question),
          referenceAnswer: question.referenceAnswer,
          answer: row.answer,
          score: row.score,
          level: row.level,
          issues: parseIssues(row.issues_json),
          suggestion: row.suggestion,
          submittedAt: row.created_at,
          mastered: row.score >= config.reviewScoreThreshold
        };
      })
      .filter(Boolean)
  });
});

app.post("/api/submissions", requireAuth, async (req, res, next) => {
  try {
    const questionId = String(req.body?.questionId || "");
    const answer = String(req.body?.answer || "").trim();
    const mode = req.body?.mode === "review" ? "review" : "day";
    const attemptId = req.body?.attemptId ? Number(req.body.attemptId) : null;
    if (!questionId || !answer) {
      res.status(400).json({ error: "请填写题目和答案。" });
      return;
    }

    const question = getQuestion(questionId);
    if (!question) {
      res.status(404).json({ error: "没有找到这道题。" });
      return;
    }

    if (mode === "day" && attemptId) {
      const attempt = database.getDayAttempt(attemptId);
      if (!attempt || attempt.season !== question.season || attempt.day !== question.day) {
        res.status(400).json({ error: "这次练习记录和题目不匹配。" });
        return;
      }
    }

    const grade = await gradeAnswer(config, question, answer);
    database.saveSubmission({
      questionId,
      season: question.season,
      day: question.day,
      questionNo: question.questionNo,
      answer,
      grade,
      attemptId: mode === "day" ? attemptId : null,
      mode
    });
    const attemptStats = mode === "day" && attemptId ? database.completeDayAttemptIfReady(attemptId) : null;

    res.json({ questionId, grade, attempt: attemptStats });
  } catch (error) {
    if (error instanceof AiConfigError) {
      res.status(503).json({ error: error.message });
      return;
    }
    next(error);
  }
});

app.get("/api/progress", requireAuth, (_req, res) => {
  const bank = getBank();
  const dayQuestionCounts = getDayQuestionCounts();
  const latestSubmissions = database.latestSubmissions();
  const dayProgress = computeDayProgress(latestSubmissions, dayQuestionCounts, config.reviewScoreThreshold);
  const completedDays = [...dayProgress.values()].filter((day) => day.completed).length;
  const submittedQuestions = new Set(latestSubmissions.map((row) => row.question_id)).size;
  const reviewStats = database.getReviewStats(config.reviewScoreThreshold);

  res.json({
    totalQuestions: bank.totalQuestions,
    submittedQuestions,
    totalDays: bank.totalDays,
    completedDays,
    completedAverageScore: database.getCompletedDayAverageScore(),
    submissionCount: database.countSubmissions(),
    reviewCount: reviewStats.currentReviewCount,
    reviewedQuestionCount: reviewStats.reviewedQuestionCount,
    reviewSubmissionCount: reviewStats.reviewSubmissionCount,
    reviewMasteredQuestionCount: reviewStats.reviewMasteredQuestionCount,
    recent: database.recentSubmissions(8)
  });
});

app.use(express.static(publicDir()));
app.get(/.*/, (_req, res) => {
  res.sendFile("index.html", { root: publicDir() });
});

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(error);
  res.status(500).json({ error: "服务器遇到了一点问题，请稍后再试。" });
});

app.listen(config.port, () => {
  console.log(`C2E practice listening on port ${config.port}`);
});

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!config.sessionSecret) {
    res.status(503).json({ error: "SESSION_SECRET 未配置。" });
    return;
  }
  const token = readSessionToken(req);
  if (!token || !database.hasSession(token)) {
    res.status(401).json({ error: "请先登录。" });
    return;
  }
  next();
}

function readSessionToken(req: Request): string | null {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader || !config.sessionSecret) return null;
  const cookies = Object.fromEntries(
    cookieHeader.split(";").map((part) => {
      const [key, ...value] = part.trim().split("=");
      return [key, decodeURIComponent(value.join("="))];
    })
  );
  const signed = cookies[authCookieName];
  if (!signed) return null;
  return verifySignedToken(signed, config.sessionSecret);
}

function signToken(token: string, secret: string): string {
  const signature = crypto.createHmac("sha256", secret).update(token).digest("base64url");
  return `${token}.${signature}`;
}

function verifySignedToken(signed: string, secret: string): string | null {
  const separator = signed.lastIndexOf(".");
  if (separator === -1) return null;
  const token = signed.slice(0, separator);
  const expected = signToken(token, secret);
  return timingSafeEqual(signed, expected) ? token : null;
}

function timingSafeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function getDayQuestionCounts(): Map<string, number> {
  const counts = new Map<string, number>();
  for (const season of getBank().seasons) {
    for (const day of season.days) {
      counts.set(`${season.season}:${day.day}`, day.questionCount);
    }
  }
  return counts;
}

function parseIssues(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map((issue) => String(issue)).filter(Boolean).slice(0, 3) : [];
  } catch {
    return [];
  }
}
