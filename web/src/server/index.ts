import crypto from "node:crypto";
import { accessSync, constants, mkdirSync } from "node:fs";
import express, { type NextFunction, type Request, type Response } from "express";
import { loadConfig, publicDir } from "./config.js";
import { registerAdminRoutes, walletTxToJson } from "./adminRoutes.js";
import { AppDatabase, computeDayProgress, shanghaiDateString, type WordPracticeKind } from "./db.js";
import { AiConfigError, gradeAnswer, gradeExampleRecall, gradeWordRecall } from "./grader.js";
import { intentToAdjustCents, parseWalletCommand } from "./walletIntent.js";
import { generateWordAudio } from "./tts.js";
import { getBank, getDayQuestions, getQuestion, initQuestionBank, loadSeedQuestionBank, toPublicQuestion } from "./questionBank.js";
import type { WordEntry } from "./types.js";
import {
  getWord,
  getWordBank,
  getWordsByTag,
  initWordBank,
  loadSeedWordBank,
  reloadWordBank,
  resolveWordAudioPath,
  toPublicWordDetails,
  toPublicWordPrompt
} from "./wordBank.js";

const config = loadConfig();
const database = new AppDatabase(config);
const WORD_PROFILES: Record<
  WordPracticeKind,
  { kind: WordPracticeKind; scopeTag: string; title: string; heroTitle: string; subtitle: string; includesExamples: boolean }
> = {
  junior: {
    kind: "junior",
    scopeTag: "shanghai-zhongkao",
    title: "上海初中英语考纲词汇",
    heroTitle: "听发音，默写单词和例句",
    subtitle: "中考词汇练习",
    includesExamples: true
  },
  senior: {
    kind: "senior",
    scopeTag: "senior-candidate",
    title: "高考词汇练习",
    heroTitle: "听发音，默写单词和中文意思",
    subtitle: "高考考纲词汇",
    includesExamples: false
  }
};
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
  const ttsSettings = database.getTtsSettings(config);
  res.json({
    ok: true,
    database: true,
    aiConfigured: aiSettings.configured,
    ttsConfigured: ttsSettings.configured,
    ttsProvider: ttsSettings.provider,
    generatedAudioWritable: generatedAudioDirWritable(),
    authConfigured: Boolean(config.appPassword && config.sessionSecret),
    siriConfigured: Boolean(config.siriApiToken),
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

app.get("/api/word/catalog", requireAuth, (req, res) => {
  const profile = wordProfileFromRequest(req);
  const bank = getWordBank();
  const scopeWords = getWordsByTag(profile.scopeTag);
  res.json({
    profile: profile.kind,
    title: profile.title,
    heroTitle: profile.heroTitle,
    subtitle: profile.subtitle,
    includesExamples: profile.includesExamples,
    totalWords: profile.kind === "junior" ? getWordScopeDisplayTotal(scopeWords.length, profile.kind) : scopeWords.length,
    totalAudioFiles: bank.totalAudioFiles,
    missingAudioCount: bank.missingAudio.length,
    generatedAt: bank.generatedAt,
    tags: bank.tags
  });
});

app.get("/api/word/settings", requireAuth, (req, res) => {
  const profile = wordProfileFromRequest(req);
  res.json({ profile: profile.kind, batchSize: database.getWordBatchSize(profile.kind) });
});

app.patch("/api/word/settings", requireAuth, (req, res) => {
  const profile = wordProfileFromRequest(req);
  const batchSize = database.setWordBatchSize(Number(req.body?.batchSize), profile.kind);
  res.json({ profile: profile.kind, batchSize });
});

app.get("/api/word/progress", requireAuth, (req, res) => {
  const profile = wordProfileFromRequest(req);
  const scopeWords = getWordsByTag(profile.scopeTag);
  const totalWords = getWordScopeDisplayTotal(scopeWords.length, profile.kind);
  res.json({
    profile: profile.kind,
    threshold: config.reviewScoreThreshold,
    scopeTag: profile.scopeTag,
    ...database.getWordProgress(
      totalWords,
      config.reviewScoreThreshold,
      scopeWords.map((word) => word.id),
      profile.kind
    )
  });
});

app.get("/api/word/levels", requireAuth, (req, res) => {
  const profile = wordProfileFromRequest(req);
  res.json({
    profile: profile.kind,
    threshold: config.reviewScoreThreshold,
    scopeTag: profile.scopeTag,
    levelSize: database.getWordBatchSize(profile.kind),
    totalWords: getWordScopeDisplayTotal(getWordsByTag(profile.scopeTag).length, profile.kind),
    groups: buildWordLevelGroups(profile.kind)
  });
});

app.get("/api/word-review", requireAuth, (req, res) => {
  const profile = wordProfileFromRequest(req);
  const scopeIds = new Set(getWordsByTag(profile.scopeTag).map((word) => word.id));
  const rows = database.latestWordReviewRows(config.reviewScoreThreshold, profile.kind);
  res.json({
    profile: profile.kind,
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

app.get("/api/word-audio/:wordId", requireAuth, async (req, res) => {
  let word = getWord(String(req.params.wordId));
  if (!word) {
    res.status(404).json({ error: "没有找到这个单词。" });
    return;
  }
  let audioPath = resolveWordAudioPath(config, word);
  if (!audioPath) {
    const settings = database.getTtsSettings(config);
    if (settings.configured) {
      try {
        const generated = await generateWordAudio(config, settings, word, fetch, {
          kind: "tts",
          operation: "word-audio-generate",
          refType: "word",
          refId: word.id,
          log: (entry) => database.recordModelInteraction(entry)
        });
        database.updateWordAudioPath(word.id, generated.relativePath);
        reloadWordBank();
        word = getWord(word.id) || word;
        audioPath = generated.absolutePath;
      } catch (error) {
        res.status(502).json({
          error: error instanceof Error ? `发音自动生成失败：${error.message}` : "发音自动生成失败。"
        });
        return;
      }
    }
  }
  if (!audioPath) {
    res.status(404).json({ error: "这个单词暂时没有发音文件，请在后台配置 TTS 后生成。" });
    return;
  }
  res.set("Cache-Control", "no-store");
  res.sendFile(audioPath);
});

app.post("/api/word-sessions/start", requireAuth, (req, res) => {
  const profile = wordProfileFromRequest(req);
  const tag = profile.scopeTag;
  const mode = req.body?.mode === "review" ? "review" : "new";
  const levelId = req.body?.levelId ? String(req.body.levelId) : null;
  const limit = database.getWordBatchSize(profile.kind);
  const words = levelId ? selectWordLevelWords(levelId, mode, profile.kind) : selectWordSessionWords(tag, mode, limit, profile.kind);
  if (words.length === 0) {
    res.status(404).json({ error: mode === "review" ? "这一关暂时没有需要复习的单词了。" : "没有找到可练习的单词。" });
    return;
  }

  // 复习会话单独成会话（mode='review'），与整关重练（mode='level'）的进度互不覆盖。
  const session = levelId
    ? mode === "review"
      ? database.startOrResumeWordSession(words, tag, "review", levelId, config.reviewScoreThreshold, profile.kind)
      : database.startOrResumeWordSession(words, tag, "level", levelId, config.reviewScoreThreshold, profile.kind)
    : database.startWordSession(words, tag, mode, null, profile.kind);
  const resume = ("resume" in session ? session.resume : null) as WordSessionResume | null;
  const resumed = "resumed" in session ? session.resumed : false;
  const resumeWord = resume && resume.phase === "example" ? words[resume.itemNo - 1] : null;
  res.json({
    sessionId: session.sessionId,
    profile: profile.kind,
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

app.post("/api/word-sessions/:sessionId/summary", requireAuth, (req, res) => {
  const profile = wordProfileFromRequest(req);
  const sessionId = Number(req.params.sessionId);
  if (!Number.isInteger(sessionId) || sessionId <= 0) {
    res.status(400).json({ error: "这次词汇练习记录无效。" });
    return;
  }

  const session = database.getWordSession(sessionId);
  if (!session) {
    res.status(404).json({ error: "没有找到这次词汇练习记录。" });
    return;
  }
  if (session.practice_kind !== profile.kind || session.scope_tag !== profile.scopeTag) {
    res.status(400).json({ error: "这次词汇练习类型和单词不匹配。" });
    return;
  }
  if (profile.kind !== "senior") {
    res.status(400).json({ error: "只有高考词汇练习需要整组总结。" });
    return;
  }

  database.completeWordSessionIfReady(sessionId, config.reviewScoreThreshold);
  const summary = database.getWordSessionSummary(sessionId);
  if (!summary || summary.submittedCount < summary.session.word_count || summary.session.status !== "completed") {
    res.status(409).json({ error: "这一组还没有全部完成。" });
    return;
  }

  const wallet = database.settleSeniorWordSessionWallet(sessionId);
  const walletSettings = database.getWalletSettings();
  res.json({
    profile: profile.kind,
    sessionId,
    mode: summary.session.mode,
    levelId: summary.session.level_id,
    wordCount: summary.session.word_count,
    submittedCount: summary.submittedCount,
    errorCount: summary.errorCount,
    averageScore: summary.averageScore,
    displayAverageScore: summary.averageScore === null ? null : Math.round(summary.averageScore),
    rewardAverageAbove: walletSettings.seniorWordRewardAverageAbove,
    penaltyAverageBelow: walletSettings.seniorWordPenaltyAverageBelow,
    wallet,
    items: summary.items.map((item) => {
      const word = getWord(item.wordId);
      return {
        itemNo: item.itemNo,
        wordId: item.wordId,
        name: word?.name || item.wordId,
        definitions: word?.definitions.map((definition) => ({
          partOfSpeech: definition.partOfSpeech,
          meaning: definition.meaning
        })) || [],
        score: item.score,
        level: item.level,
        errorSummary: item.errorSummary
      };
    })
  });
});

app.post("/api/word-submissions", requireAuth, async (req, res, next) => {
  try {
    const profile = wordProfileFromRequest(req);
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
      if (session.practice_kind !== profile.kind || session.scope_tag !== profile.scopeTag) {
        res.status(400).json({ error: "这次词汇练习类型和单词不匹配。" });
        return;
      }
    }

    if (phase === "example" && !profile.includesExamples) {
      res.status(400).json({ error: "高考词汇练习不需要默写例句。" });
      return;
    }

    if (phase === "example" && (database.latestWordPhaseScore(wordId, "word", profile.kind) ?? 0) < config.reviewScoreThreshold) {
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
        ? await gradeWordRecall(currentGradeConfig(), word, { wordAnswer, meaningAnswers }, {
            kind: "grading",
            operation: "word-recall",
            refType: "word",
            refId: word.id,
            log: (entry) => database.recordModelInteraction(entry)
          })
        : await gradeExampleRecall(currentGradeConfig(), word, exampleAnswers, {
            kind: "grading",
            operation: "word-example",
            refType: "word",
            refId: word.id,
            log: (entry) => database.recordModelInteraction(entry)
          });
    const submissionId = database.saveWordSubmission({
      sessionId,
      practiceKind: profile.kind,
      wordId,
      phase,
      wordAnswer: phase === "word" ? wordAnswer : null,
      meaningAnswers,
      answer: phase === "word" ? JSON.stringify({ wordAnswer, meaningAnswers }) : JSON.stringify({ exampleAnswers }),
      grade
    });
    const sessionComplete = sessionId ? database.completeWordSessionIfReady(sessionId, config.reviewScoreThreshold) : false;
    const wallet =
      profile.kind === "senior"
        ? null
        : database.settleSubmissionWallet({
            source: "word",
            practiceKind: profile.kind,
            wordId,
            phase,
            submissionId,
            score: grade.score,
            errorSummary: grade.errorSummary
          });

    res.json({
      profile: profile.kind,
      wordId,
      phase,
      grade,
      sessionComplete,
      details: toPublicWordDetails(word),
      wallet
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

    const grade = await gradeAnswer(currentGradeConfig(), question, answer, {
      kind: "grading",
      operation: "sentence-grade",
      refType: "question",
      refId: question.id,
      log: (entry) => database.recordModelInteraction(entry)
    });
    const submissionId = database.saveSubmission({
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
    const wallet = database.settleSubmissionWallet({
      source: "sentence",
      questionId,
      submissionId,
      score: grade.score,
      errorSummary: grade.errorSummary
    });

    res.json({ questionId, grade, attempt: attemptStats, wallet });
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

app.get("/api/activity-calendar", requireAuth, (req, res) => {
  const currentYear = Number(shanghaiDateString(new Date()).slice(0, 4));
  const requestedYear = Number(req.query.year);
  const year = Number.isInteger(requestedYear) && requestedYear >= 2000 && requestedYear <= 2100 ? requestedYear : currentYear;
  res.json(database.getActivityCalendar(year));
});

app.get("/api/wallet", requireAuth, (_req, res) => {
  const settings = database.getWalletSettings();
  const balanceCents = database.getWalletBalance();
  const { items } = database.walletTransactions(50, 0);
  res.json({
    balanceCents,
    thresholdCents: settings.withdrawThresholdCents,
    canWithdraw: balanceCents >= settings.withdrawThresholdCents,
    transactions: items.map(walletTxToJson),
    withdrawals: database.listWithdrawals().map(walletTxToJson)
  });
});

app.post("/api/wallet/withdraw", requireAuth, (_req, res) => {
  try {
    const withdrawal = database.createWithdrawal();
    res.json({
      ok: true,
      withdrawal: { id: withdrawal.id, amountCents: withdrawal.amountCents, status: "pending" },
      balanceCents: withdrawal.balance
    });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "提现失败,请稍后再试。" });
  }
});

// --- Siri 快捷指令（语音钱包，Bearer Token 鉴权，见 docs/siri-shortcut.md） ---

app.get("/api/siri/wallet", requireSiriToken, (_req, res) => {
  const balanceCents = database.getWalletBalance();
  res.json({ ok: true, balanceCents, speech: `钱包现在有 ${speechYuan(balanceCents)}。` });
});

app.post("/api/siri/wallet/adjust", requireSiriToken, (req, res) => {
  const amountYuan = Number(req.body?.amountYuan);
  const note = String(req.body?.note || "").trim().slice(0, 100);
  const action = amountYuan > 0 ? "add" : "deduct";
  try {
    const amountCents = intentToAdjustCents({ action, amountYuan: Math.abs(amountYuan), note: note || null });
    const result = database.adjustWallet(amountCents, note || "Siri 语音调整");
    res.json({ ok: true, balanceCents: result.balance, speech: adjustSpeech(amountCents, note || null, result.balance) });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "金额无效。" });
  }
});

app.post("/api/siri/wallet/command", requireSiriToken, async (req, res) => {
  const text = String(req.body?.text || "").trim();
  if (!text) {
    res.json({ ok: false, action: "unknown", balanceCents: database.getWalletBalance(), speech: "没听到内容，请再说一次。" });
    return;
  }

  let intent;
  try {
    intent = await parseWalletCommand(currentGradeConfig(), text, {
      kind: "siri",
      operation: "siri-wallet-command",
      refType: "wallet",
      refId: "command",
      log: (entry) => database.recordModelInteraction(entry)
    });
  } catch (error) {
    const speech = error instanceof AiConfigError ? "AI 模型还没配置好，暂时无法理解语音指令。" : "解析出了点问题，请稍后再试。";
    res.json({ ok: false, action: "unknown", balanceCents: database.getWalletBalance(), speech });
    return;
  }

  if (intent.action === "query") {
    const balanceCents = database.getWalletBalance();
    res.json({ ok: true, action: "query", balanceCents, speech: `钱包现在有 ${speechYuan(balanceCents)}。` });
    return;
  }

  // add / deduct / unknown：金额或意图不合规时只朗读原因，不动钱包。
  try {
    const amountCents = intentToAdjustCents(intent);
    const result = database.adjustWallet(amountCents, intent.note || "Siri 语音调整");
    res.json({ ok: true, action: intent.action, balanceCents: result.balance, speech: adjustSpeech(amountCents, intent.note, result.balance) });
  } catch (error) {
    res.json({
      ok: false,
      action: intent.action,
      balanceCents: database.getWalletBalance(),
      speech: error instanceof Error ? error.message : "没听懂，请再说一次，比如：加 5 元。"
    });
  }
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

function requireSiriToken(req: Request, res: Response, next: NextFunction) {
  if (!config.siriApiToken) {
    res.status(503).json({ error: "SIRI_API_TOKEN 未配置。" });
    return;
  }
  const auth = String(req.headers.authorization || "");
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token || !timingSafeEqual(token, config.siriApiToken)) {
    res.status(401).json({ error: "无效的访问令牌。" });
    return;
  }
  next();
}

function speechYuan(cents: number): string {
  const abs = Math.abs(cents);
  const text = abs % 100 === 0 ? String(abs / 100) : (abs / 100).toFixed(2);
  return `${cents < 0 ? "负 " : ""}${text} 元`;
}

function adjustSpeech(amountCents: number, note: string | null, balanceCents: number): string {
  const verb = amountCents > 0 ? "已加" : "已扣";
  const noteText = note ? `备注“${note}”，` : "";
  return `${verb} ${speechYuan(Math.abs(amountCents))}，${noteText}当前余额 ${speechYuan(balanceCents)}。`;
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

function wordProfileFromRequest(req: Request) {
  const rawProfile = typeof req.query.profile === "string" ? req.query.profile : String(req.body?.profile || "");
  return WORD_PROFILES[rawProfile === "senior" ? "senior" : "junior"];
}

function getWordScopeDisplayTotal(fallback: number, practiceKind: WordPracticeKind): number {
  if (practiceKind === "junior") return getWordBank().zhongkao?.matchedSourceRows || fallback || getWordBank().totalWords;
  return fallback || getWordBank().totalWords;
}

function generatedAudioDirWritable(): boolean {
  try {
    mkdirSync(config.wordAudioGeneratedDir, { recursive: true });
    accessSync(config.wordAudioGeneratedDir, constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

function buildWordLevelGroups(practiceKind: WordPracticeKind) {
  const practiced = database.practicedWordIds(practiceKind);
  const mastered = database.masteredWordIds(config.reviewScoreThreshold, practiceKind);
  const reviewIds = new Set(database.latestWordReviewRows(config.reviewScoreThreshold, practiceKind).map((row) => row.word_id));
  const attemptStats = database.wordLevelAttemptStats(practiceKind);

  return getWordLevelChunks(practiceKind).map((group) => ({
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

function selectWordLevelWords(levelId: string, mode: "new" | "review" = "new", practiceKind: WordPracticeKind): WordEntry[] {
  let levelWords: WordEntry[] = [];
  for (const group of getWordLevelChunks(practiceKind)) {
    const level = group.levels.find((item) => item.id === levelId);
    if (level) {
      levelWords = level.words;
      break;
    }
  }
  if (mode !== "review") return levelWords;

  // 复习模式：只保留该关里最新分低于阈值的错词。
  const reviewIds = new Set(database.latestWordReviewRows(config.reviewScoreThreshold, practiceKind).map((row) => row.word_id));
  return levelWords.filter((word) => reviewIds.has(word.id));
}

function getWordLevelChunks(practiceKind: WordPracticeKind) {
  const words = getWordsByTag(WORD_PROFILES[practiceKind].scopeTag);
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
      levels: chunkWords(groupWords, database.getWordBatchSize(practiceKind)).map((chunk, index) => ({
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

function selectWordSessionWords(tag: string, mode: "new" | "review", limit: number, practiceKind: WordPracticeKind) {
  const candidates = getWordsByTag(tag);
  const candidateIds = new Set(candidates.map((word) => word.id));
  if (mode === "review") {
    return database
      .latestWordReviewRows(config.reviewScoreThreshold, practiceKind)
      .map((row) => getWord(row.word_id))
      .filter((word): word is NonNullable<typeof word> => Boolean(word && candidateIds.has(word.id)))
      .slice(0, limit);
  }

  const mastered = database.masteredWordIds(config.reviewScoreThreshold, practiceKind);
  const reviewIds = new Set(database.latestWordReviewRows(config.reviewScoreThreshold, practiceKind).map((row) => row.word_id));
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
