import crypto from "node:crypto";
import express, { type NextFunction, type Request, type Response } from "express";
import { loadConfig, publicDir } from "./config.js";
import { registerAdminRoutes } from "./adminRoutes.js";
import { AppDatabase, computeDayProgress } from "./db.js";
import { AiConfigError, gradeAnswer, gradeExampleRecall, gradeWordRecall } from "./grader.js";
import { getBank, getDayQuestions, getQuestion, initQuestionBank, loadSeedQuestionBank, toPublicQuestion } from "./questionBank.js";
import type { WordEntry } from "./types.js";
import {
  getWord,
  getWordBank,
  getWordsByTag,
  initWordBank,
  loadSeedWordBank,
  resolveWordAudioPath,
  toPublicWordDetails,
  toPublicWordPrompt
} from "./wordBank.js";

const config = loadConfig();
const database = new AppDatabase(config);
const DEFAULT_WORD_SCOPE_TAG = "shanghai-zhongkao";
const WORD_LEVEL_SIZE = 5;
type WordSessionResume = ReturnType<AppDatabase["getWordSessionResume"]>;
database.pruneSessions();
seedReferenceData();
initQuestionBank(database);
initWordBank(database, config);
database.backfillLegacyDayAttempts(getDayQuestionCounts());

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "64kb" }));

const authCookieName = "c2e_session";

app.get("/api/health", (_req, res) => {
  const aiSettings = database.getAiModelSettings(config);
  res.json({
    ok: true,
    database: true,
    aiConfigured: aiSettings.configured,
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

app.post("/api/admin/login", (req, res) => {
  if (!config.adminPassword || !config.sessionSecret) {
    res.status(503).json({ error: "ADMIN_PASSWORD 或 SESSION_SECRET 未配置。" });
    return;
  }

  const password = String(req.body?.password || "");
  const ok = timingSafeEqual(password, config.adminPassword);
  if (!ok) {
    res.status(401).json({ error: "管理员口令不正确。" });
    return;
  }

  const token = database.createSession("admin");
  res.cookie(authCookieName, signToken(token, config.sessionSecret), {
    httpOnly: true,
    sameSite: "lax",
    secure: config.nodeEnv === "production",
    maxAge: 1000 * 60 * 60 * 24 * 30,
    path: "/"
  });
  res.json({ ok: true, role: "admin" });
});

app.post("/api/logout", requireAuth, (req, res) => {
  const token = readSessionToken(req);
  if (token) database.deleteSession(token);
  res.clearCookie(authCookieName, { path: "/" });
  res.json({ ok: true });
});

app.get("/api/me", requireAuth, (req, res) => {
  const token = readSessionToken(req);
  const role = token ? database.getSessionRole(token) : null;
  res.json({ role: role || "user" });
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
  const attempt = database.startOrResumeDayAttempt(season, day, questions.length);
  res.json({ ...attempt, season, day, questionCount: questions.length });
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

app.get("/api/word/catalog", requireAuth, (_req, res) => {
  const bank = getWordBank();
  res.json({
    title: "上海初中英语考纲词汇",
    totalWords: bank.totalWords,
    totalAudioFiles: bank.totalAudioFiles,
    missingAudioCount: bank.missingAudio.length,
    generatedAt: bank.generatedAt,
    tags: bank.tags
  });
});

app.get("/api/word/settings", requireAuth, (_req, res) => {
  res.json({ batchSize: database.getWordBatchSize() });
});

app.patch("/api/word/settings", requireAuth, (req, res) => {
  const batchSize = database.setWordBatchSize(Number(req.body?.batchSize));
  res.json({ batchSize });
});

app.get("/api/word/progress", requireAuth, (_req, res) => {
  const scopeWords = getWordsByTag(DEFAULT_WORD_SCOPE_TAG);
  const totalWords = getWordScopeDisplayTotal(scopeWords.length);
  res.json({
    threshold: config.reviewScoreThreshold,
    scopeTag: DEFAULT_WORD_SCOPE_TAG,
    ...database.getWordProgress(
      totalWords,
      config.reviewScoreThreshold,
      scopeWords.map((word) => word.id)
    )
  });
});

app.get("/api/word/levels", requireAuth, (_req, res) => {
  res.json({
    threshold: config.reviewScoreThreshold,
    scopeTag: DEFAULT_WORD_SCOPE_TAG,
    levelSize: WORD_LEVEL_SIZE,
    totalWords: getWordScopeDisplayTotal(getWordsByTag(DEFAULT_WORD_SCOPE_TAG).length),
    groups: buildWordLevelGroups()
  });
});

app.get("/api/word-review", requireAuth, (_req, res) => {
  const scopeIds = new Set(getWordsByTag(DEFAULT_WORD_SCOPE_TAG).map((word) => word.id));
  const rows = database.latestWordReviewRows(config.reviewScoreThreshold);
  res.json({
    threshold: config.reviewScoreThreshold,
    words: rows
      .filter((row) => scopeIds.has(row.word_id))
      .map((row) => {
        const word = getWord(row.word_id);
        if (!word) return null;
        return {
          ...toPublicWordPrompt(word, 0),
          details: toPublicWordDetails(word),
          lastScore: row.latest_score,
          lastPhase: row.latest_phase,
          lastIssues: parseIssues(row.latest_issues_json),
          lastSubmittedAt: row.latest_at
        };
      })
      .filter(Boolean)
  });
});

app.get("/api/word-audio/:wordId", requireAuth, (req, res) => {
  const word = getWord(String(req.params.wordId));
  if (!word) {
    res.status(404).json({ error: "没有找到这个单词。" });
    return;
  }
  const audioPath = resolveWordAudioPath(config, word);
  if (!audioPath) {
    res.status(404).json({ error: "这个单词暂时没有发音文件。" });
    return;
  }
  res.sendFile(audioPath);
});

app.post("/api/word-sessions/start", requireAuth, (req, res) => {
  const tag = String(req.body?.tag || DEFAULT_WORD_SCOPE_TAG);
  const mode = req.body?.mode === "review" ? "review" : "new";
  const levelId = req.body?.levelId ? String(req.body.levelId) : null;
  const limit = database.getWordBatchSize();
  const words = levelId ? selectWordLevelWords(levelId, mode) : selectWordSessionWords(tag, mode, limit);
  if (words.length === 0) {
    res.status(404).json({ error: mode === "review" ? "这一关暂时没有需要复习的单词了。" : "没有找到可练习的单词。" });
    return;
  }

  // 复习会话单独成会话（mode='review'），与整关重练（mode='level'）的进度互不覆盖。
  const session = levelId
    ? mode === "review"
      ? database.startOrResumeWordSession(words, tag, "review", levelId, config.reviewScoreThreshold)
      : database.startOrResumeWordSession(words, tag, "level", levelId, config.reviewScoreThreshold)
    : database.startWordSession(words, tag, mode);
  const resume = ("resume" in session ? session.resume : null) as WordSessionResume | null;
  const resumed = "resumed" in session ? session.resumed : false;
  const resumeWord = resume && resume.phase === "example" ? words[resume.itemNo - 1] : null;
  res.json({
    sessionId: session.sessionId,
    scopeTag: session.scopeTag,
    mode: session.mode,
    levelId,
    resumed,
    resume: resume
      ? {
          ...resume,
          details: resumeWord ? toPublicWordDetails(resumeWord) : null
        }
      : null,
    wordCount: session.wordCount,
    words: session.words.map(({ word, itemNo }) => toPublicWordPrompt(word, itemNo))
  });
});

app.post("/api/word-submissions", requireAuth, async (req, res, next) => {
  try {
    const sessionId = req.body?.sessionId ? Number(req.body.sessionId) : null;
    const wordId = String(req.body?.wordId || "");
    const phase = req.body?.phase === "example" ? "example" : "word";
    const word = getWord(wordId);
    if (!word) {
      res.status(404).json({ error: "没有找到这个单词。" });
      return;
    }

    if (sessionId) {
      const session = database.getWordSession(sessionId);
      if (!session || !database.getWordSessionWordIds(sessionId).includes(wordId)) {
        res.status(400).json({ error: "这次词汇练习记录和单词不匹配。" });
        return;
      }
    }

    if (phase === "example" && (database.latestWordPhaseScore(wordId, "word") ?? 0) < config.reviewScoreThreshold) {
      res.status(400).json({ error: "请先通过单词和中文释义默写，再练例句。" });
      return;
    }

    const meaningAnswers = normalizeMeaningAnswers(req.body?.meaningAnswers);
    const wordAnswer = String(req.body?.wordAnswer || "").trim();
    const exampleAnswers = normalizeExampleAnswers(req.body?.exampleAnswers, req.body?.answer);
    if (phase === "word" && !wordAnswer) {
      res.status(400).json({ error: "请先默写英文单词。" });
      return;
    }
    if (phase === "example" && !exampleAnswers.some((entry) => entry.trim())) {
      res.status(400).json({ error: "请先默写英文例句。" });
      return;
    }

    const grade =
      phase === "word"
        ? await gradeWordRecall(currentGradeConfig(), word, { wordAnswer, meaningAnswers })
        : await gradeExampleRecall(currentGradeConfig(), word, exampleAnswers);
    database.saveWordSubmission({
      sessionId,
      wordId,
      phase,
      wordAnswer: phase === "word" ? wordAnswer : null,
      meaningAnswers,
      answer: phase === "word" ? JSON.stringify({ wordAnswer, meaningAnswers }) : JSON.stringify({ exampleAnswers }),
      grade
    });
    const sessionComplete = sessionId ? database.completeWordSessionIfReady(sessionId, config.reviewScoreThreshold) : false;

    res.json({
      wordId,
      phase,
      grade,
      sessionComplete,
      details: toPublicWordDetails(word)
    });
  } catch (error) {
    if (error instanceof AiConfigError) {
      res.status(503).json({ error: error.message });
      return;
    }
    next(error);
  }
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

    const grade = await gradeAnswer(currentGradeConfig(), question, answer);
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

registerAdminRoutes(app, database, config, requireAdmin);

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

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!config.sessionSecret) {
    res.status(503).json({ error: "SESSION_SECRET 未配置。" });
    return;
  }
  const token = readSessionToken(req);
  if (!token || !database.hasSession(token)) {
    res.status(401).json({ error: "请先登录。" });
    return;
  }
  if (database.getSessionRole(token) !== "admin") {
    res.status(403).json({ error: "需要管理员权限。" });
    return;
  }
  next();
}

function currentGradeConfig() {
  const settings = database.getAiModelSettings(config);
  return {
    baseUrl: settings.baseUrl,
    apiKey: settings.apiKey,
    model: settings.model,
    timeoutMs: settings.timeoutMs,
    reviewScoreThreshold: config.reviewScoreThreshold
  };
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

function seedReferenceData(): void {
  const questionBank = loadSeedQuestionBank();
  const seededQuestions = database.seedQuestionsIfEmpty(questionBank.questions);
  if (seededQuestions) {
    console.log(`Seeded ${questionBank.questions.length} questions into SQLite.`);
  }

  const wordBank = loadSeedWordBank();
  const seededWords = database.seedWordsIfEmpty(wordBank.words, {
    "word.source": wordBank.source ?? null,
    "word.totalAudioFiles": wordBank.totalAudioFiles ?? null,
    "zhongkao.source": wordBank.zhongkao?.source ?? null,
    "zhongkao.extractedWordRows": wordBank.zhongkao?.extractedWordRows ?? null,
    "zhongkao.matchedSourceRows": wordBank.zhongkao?.matchedSourceRows ?? null,
    "zhongkao.unmatchedSourceRows": wordBank.zhongkao?.unmatchedSourceRows ?? null
  });
  if (seededWords) {
    console.log(`Seeded ${wordBank.words.length} words into SQLite.`);
  }
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

function getWordScopeDisplayTotal(fallback: number): number {
  return getWordBank().zhongkao?.matchedSourceRows || fallback || getWordBank().totalWords;
}

function buildWordLevelGroups() {
  const practiced = database.practicedWordIds();
  const mastered = database.masteredWordIds(config.reviewScoreThreshold);
  const reviewIds = new Set(database.latestWordReviewRows(config.reviewScoreThreshold).map((row) => row.word_id));
  const attemptStats = database.wordLevelAttemptStats();

  return getWordLevelChunks().map((group) => ({
    letter: group.letter,
    totalWords: group.words.length,
    masteredWords: group.words.filter((word) => mastered.has(word.id)).length,
    reviewWords: group.words.filter((word) => reviewIds.has(word.id)).length,
    levels: group.levels.map((level) => {
      const practicedCount = level.words.filter((word) => practiced.has(word.id)).length;
      const masteredCount = level.words.filter((word) => mastered.has(word.id)).length;
      const reviewCount = level.words.filter((word) => reviewIds.has(word.id)).length;
      const stats = attemptStats.get(level.id);
      return {
        id: level.id,
        letter: group.letter,
        levelNo: level.levelNo,
        wordCount: level.words.length,
        practicedCount,
        masteredCount,
        reviewCount,
        attemptCount: stats?.attemptCount || 0,
        bestAverageScore: stats?.bestAverageScore ?? null,
        status: reviewCount > 0 ? "review" : masteredCount === level.words.length ? "done" : practicedCount > 0 ? "active" : "fresh",
        firstWord: level.words[0]?.name || "",
        lastWord: level.words[level.words.length - 1]?.name || ""
      };
    })
  }));
}

function selectWordLevelWords(levelId: string, mode: "new" | "review" = "new"): WordEntry[] {
  let levelWords: WordEntry[] = [];
  for (const group of getWordLevelChunks()) {
    const level = group.levels.find((item) => item.id === levelId);
    if (level) {
      levelWords = level.words;
      break;
    }
  }
  if (mode !== "review") return levelWords;

  // 复习模式：只保留该关里最新分低于阈值的错词。
  const reviewIds = new Set(database.latestWordReviewRows(config.reviewScoreThreshold).map((row) => row.word_id));
  return levelWords.filter((word) => reviewIds.has(word.id));
}

function getWordLevelChunks() {
  const words = getWordsByTag(DEFAULT_WORD_SCOPE_TAG);
  const byLetter = new Map<string, WordEntry[]>();
  for (const word of words) {
    const letter = firstWordLetter(word);
    byLetter.set(letter, [...(byLetter.get(letter) || []), word]);
  }

  return [...byLetter.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([letter, groupWords]) => ({
      letter,
      words: groupWords,
      levels: chunkWords(groupWords, WORD_LEVEL_SIZE).map((chunk, index) => ({
        id: `${letter}-${index + 1}`,
        levelNo: index + 1,
        words: chunk
      }))
    }));
}

function firstWordLetter(word: WordEntry): string {
  const match = word.name.toLowerCase().match(/[a-z]/);
  return match?.[0] || "#";
}

function chunkWords(words: WordEntry[], size: number): WordEntry[][] {
  const chunks: WordEntry[][] = [];
  for (let index = 0; index < words.length; index += size) {
    chunks.push(words.slice(index, index + size));
  }
  return chunks;
}

function selectWordSessionWords(tag: string, mode: "new" | "review", limit: number) {
  const candidates = getWordsByTag(tag);
  const candidateIds = new Set(candidates.map((word) => word.id));
  if (mode === "review") {
    return database
      .latestWordReviewRows(config.reviewScoreThreshold)
      .map((row) => getWord(row.word_id))
      .filter((word): word is NonNullable<typeof word> => Boolean(word && candidateIds.has(word.id)))
      .slice(0, limit);
  }

  const mastered = database.masteredWordIds(config.reviewScoreThreshold);
  const reviewIds = new Set(database.latestWordReviewRows(config.reviewScoreThreshold).map((row) => row.word_id));
  const fresh = candidates.filter((word) => !mastered.has(word.id) && !reviewIds.has(word.id));
  return (fresh.length ? fresh : candidates).slice(0, limit);
}

function normalizeMeaningAnswers(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .map(([key, entry]) => [String(key), String(entry || "").trim()])
      .filter(([, entry]) => entry)
  );
}

// 例句答案：优先用 exampleAnswers 数组（多句），兼容旧的单句 answer 字段。
function normalizeExampleAnswers(value: unknown, legacyAnswer: unknown): string[] {
  if (Array.isArray(value)) return value.map((entry) => String(entry || ""));
  const single = String(legacyAnswer || "");
  return single ? [single] : [];
}
