import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Flag,
  History,
  Heart,
  ListChecks,
  Loader2,
  LogOut,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Settings,
  Sparkles,
  Star,
  Trash2,
  Trophy,
  Volume2,
  X
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import "./styles.css";

type DayCatalog = {
  day: number;
  questionCount: number;
  submitted: number;
  completed: boolean;
  needsReview: boolean;
  bestAverage: number | null;
  latestAverageScore: number | null;
  attemptCount: number;
  lastCompletedAt: string | null;
};

type SeasonCatalog = {
  season: number;
  title: string;
  dayCount: number;
  questionCount: number;
  days: DayCatalog[];
};

type PublicQuestion = {
  id: string;
  season: number;
  day: number;
  questionNo: number;
  chinese: string;
  prompt: string;
};

type ReviewQuestion = PublicQuestion & {
  lastScore: number;
  lastSubmittedAt: string;
  lastIssues: string[];
};

type Progress = {
  totalQuestions: number;
  submittedQuestions: number;
  totalDays: number;
  completedDays: number;
  completedAverageScore: number | null;
  submissionCount: number;
  reviewCount: number;
  reviewedQuestionCount: number;
  reviewSubmissionCount: number;
  reviewMasteredQuestionCount: number;
};

type WordProgress = {
  threshold: number;
  scopeTag?: string;
  totalWords: number;
  practicedWords: number;
  masteredWords: number;
  reviewWords: number;
  sessionCount: number;
  submissionCount: number;
};

type WordCatalogTag = {
  id: string;
  label: string;
  systemGenerated: boolean;
  count: number;
};

type WordCatalog = {
  title: string;
  totalWords: number;
  missingAudioCount: number;
  tags: WordCatalogTag[];
};

type WordLevel = {
  id: string;
  letter: string;
  levelNo: number;
  wordCount: number;
  practicedCount: number;
  masteredCount: number;
  reviewCount: number;
  status: "fresh" | "active" | "done" | "review";
  firstWord: string;
  lastWord: string;
};

type WordLevelGroup = {
  letter: string;
  totalWords: number;
  masteredWords: number;
  reviewWords: number;
  levels: WordLevel[];
};

type WordPrompt = {
  id: string;
  itemNo: number;
  partsOfSpeech: string[];
};

type WordSessionResume = {
  itemNo: number;
  phase: "word" | "example" | "complete";
  wordAnswer?: string;
  meaningAnswers?: Record<string, string>;
  wordGrade?: Grade;
  details?: WordDetails | null;
};

type WordDetails = {
  id: string;
  name: string;
  phonetics: string[];
  definitions: Array<{ phonetic: string; partOfSpeech: string; meaning: string }>;
  example: { english: string; chinese: string };
  tags: string[];
  hasAudio: boolean;
};

type ReviewHistorySummary = {
  reviewedQuestionCount: number;
  reviewSubmissionCount: number;
  reviewMasteredQuestionCount: number;
  currentReviewCount: number;
};

type ReviewHistoryQuestion = PublicQuestion & {
  referenceAnswer: string;
  reviewCount: number;
  latestAnswer: string;
  latestIssues: string[];
  latestReviewAt: string;
  currentScore: number;
  attempts: Array<{ score: number; submittedAt: string }>;
  latestReviewMastered: boolean;
  currentlyNeedsReview: boolean;
};

type ReviewHistoryRecord = PublicQuestion & {
  referenceAnswer: string;
  answer: string;
  score: number;
  level: string;
  issues: string[];
  suggestion: string;
  submittedAt: string;
  mastered: boolean;
};

type ReviewHistoryResponse = {
  threshold: number;
  summary: ReviewHistorySummary;
  questions: ReviewHistoryQuestion[];
  records: ReviewHistoryRecord[];
};

type Grade = {
  score: number;
  level: string;
  encouragement: string;
  issues: string[];
  suggestion: string;
  improvedAnswer: string;
  referenceAnswer: string;
  needsReview: boolean;
};

const DEFAULT_WORD_SCOPE_TAG = "shanghai-zhongkao";

// Injected at build time from the latest git tag (see vite.config.ts).
const APP_VERSION = typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "dev";

function App() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [catalog, setCatalog] = useState<SeasonCatalog[]>([]);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [wordProgress, setWordProgress] = useState<WordProgress | null>(null);
  const [activeDay, setActiveDay] = useState<{ season: number; day: number } | null>(null);
  const [reviewMode, setReviewMode] = useState<"center" | "practice" | null>(null);
  const [homeMode, setHomeMode] = useState<"sentences" | "words">("sentences");
  const [role, setRole] = useState<"user" | "admin">("user");
  const [adminMode, setAdminMode] = useState(() => typeof location !== "undefined" && location.hash === "#admin");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const [catalogResponse, progressResponse, wordProgressResponse, meResponse] = await Promise.all([
        api("/api/catalog"),
        api("/api/progress"),
        api("/api/word/progress"),
        api("/api/me")
      ]);
      setCatalog(catalogResponse.seasons);
      setProgress(progressResponse);
      setWordProgress(wordProgressResponse);
      setRole(meResponse.role === "admin" ? "admin" : "user");
      setAuthenticated(true);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setAuthenticated(false);
      } else {
        setError(err instanceof Error ? err.message : "加载失败");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    const onHashChange = () => setAdminMode(location.hash === "#admin");
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  function exitAdmin() {
    if (location.hash === "#admin") location.hash = "";
    setAdminMode(false);
    refresh();
  }

  if (adminMode) {
    if (authenticated && role === "admin") {
      return <AdminApp onExit={exitAdmin} />;
    }
    return (
      <AdminLoginScreen
        onLogin={async () => {
          await refresh();
        }}
        onCancel={exitAdmin}
      />
    );
  }

  if (authenticated === false) {
    return (
      <LoginScreen
        onLogin={refresh}
        onOpenAdmin={() => {
          location.hash = "#admin";
          setAdminMode(true);
        }}
      />
    );
  }

  if (loading && !catalog.length) {
    return <LoadingScreen />;
  }

  if (activeDay) {
    return (
      <PracticeScreen
        season={activeDay.season}
        day={activeDay.day}
        onBack={() => {
          setActiveDay(null);
          refresh();
        }}
      />
    );
  }

  if (reviewMode === "practice") {
    return (
      <ReviewScreen
        onBack={() => {
          setReviewMode("center");
          refresh();
        }}
      />
    );
  }

  if (reviewMode === "center") {
    return <ReviewCenter onBack={() => setReviewMode(null)} onStartPractice={() => setReviewMode("practice")} />;
  }

  return (
    <Shell
      showAdmin={role === "admin"}
      onOpenAdmin={() => {
        location.hash = "#admin";
        setAdminMode(true);
      }}
      onLogout={async () => {
        await api("/api/logout", { method: "POST" });
        setAuthenticated(false);
      }}
    >
      {error ? <div className="notice danger">{error}</div> : null}
      <HomeTabs active={homeMode} onChange={setHomeMode} progress={progress} wordProgress={wordProgress} />
      {homeMode === "sentences" ? (
        <Dashboard
          progress={progress}
          seasons={catalog}
          onStartDay={setActiveDay}
          onStartReview={() => setReviewMode("center")}
        />
      ) : (
        <WordPracticeScreen
          initialMode="new"
          embedded
          onBack={() => setHomeMode("sentences")}
        />
      )}
    </Shell>
  );
}

function Shell({
  children,
  onLogout,
  showAdmin,
  onOpenAdmin
}: {
  children: React.ReactNode;
  onLogout: () => void;
  showAdmin?: boolean;
  onOpenAdmin?: () => void;
}) {
  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">
            <Sparkles size={22} />
          </span>
          <div>
            <p>英语练习</p>
            <strong>
              每日闯关
              <span className="app-version">{APP_VERSION}</span>
            </strong>
          </div>
        </div>
        <div className="topbar-actions">
          {showAdmin ? (
            <button className="icon-button" onClick={onOpenAdmin} title="后台管理">
              <Settings size={20} />
            </button>
          ) : null}
          <button className="icon-button" onClick={onLogout} title="退出登录">
            <LogOut size={20} />
          </button>
        </div>
      </header>
      {children}
    </main>
  );
}

function LoginScreen({ onLogin, onOpenAdmin }: { onLogin: () => void; onOpenAdmin: () => void }) {
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await api("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password })
      });
      onLogin();
    } catch (err) {
      setError(err instanceof Error ? err.message : "登录失败");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-panel">
        <div className="login-mark">
          <BookOpen size={44} />
        </div>
        <h1>中译英每日闯关</h1>
        <p>输入家庭口令，继续今天的英文练习。</p>
        <form onSubmit={submit}>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="家庭口令"
            autoFocus
          />
          <button className="primary-button" disabled={submitting || !password}>
            {submitting ? <Loader2 className="spin" size={20} /> : <Sparkles size={20} />}
            开始闯关
          </button>
        </form>
        {error ? <div className="notice danger">{error}</div> : null}
        <button className="link-button" onClick={onOpenAdmin}>
          <Settings size={16} />
          管理员登录
        </button>
      </section>
    </main>
  );
}

function HomeTabs({
  active,
  onChange,
  progress,
  wordProgress
}: {
  active: "sentences" | "words";
  onChange: (value: "sentences" | "words") => void;
  progress: Progress | null;
  wordProgress: WordProgress | null;
}) {
  return (
    <nav className="home-tabs" aria-label="练习类型">
      <button className={active === "sentences" ? "active" : ""} onClick={() => onChange("sentences")}>
        <Flag size={19} />
        中译英
        {progress?.reviewCount ? <span>{progress.reviewCount}</span> : null}
      </button>
      <button className={active === "words" ? "active" : ""} onClick={() => onChange("words")}>
        <BookOpen size={19} />
        词汇练习
        {wordProgress?.reviewWords ? <span>{wordProgress.reviewWords}</span> : null}
      </button>
    </nav>
  );
}

function Dashboard({
  progress,
  seasons,
  onStartDay,
  onStartReview
}: {
  progress: Progress | null;
  seasons: SeasonCatalog[];
  onStartDay: (day: { season: number; day: number }) => void;
  onStartReview: () => void;
}) {
  const nextDay = useMemo(() => {
    for (const season of seasons) {
      const day = season.days.find((item) => !item.completed);
      if (day) return { season: season.season, day: day.day };
    }
    return seasons[0]?.days[0] ? { season: seasons[0].season, day: seasons[0].days[0].day } : null;
  }, [seasons]);

  const total = progress?.totalQuestions || 1;
  const submitted = progress?.submittedQuestions || 0;
  const percent = (submitted / total) * 100;
  const percentLabel = percent > 0 && percent < 1 ? `${percent.toFixed(1)}%` : `${Math.round(percent)}%`;

  return (
    <>
      <section className="hero-band">
        <div>
          <span className="eyebrow">
            <Heart size={16} />
            今天也来一点点
          </span>
          <h1>把中文句子变成漂亮英文</h1>
          <p>按天闯关，写完一句就马上得到鼓励和修改建议。</p>
          <button className="primary-button wide" disabled={!nextDay} onClick={() => nextDay && onStartDay(nextDay)}>
            <Flag size={20} />
            继续 Day {nextDay?.day ?? 1}
            <ArrowRight size={20} />
          </button>
        </div>
        <div className="progress-ring" style={{ "--progress": `${percent}%` } as React.CSSProperties}>
          <strong>{percentLabel}</strong>
          <span>总进度</span>
        </div>
      </section>

      <section className="stats-grid">
        <Stat icon={Trophy} label="已完成 Day" value={`${progress?.completedDays || 0}/${progress?.totalDays || 224}`} />
        <Stat
          icon={Star}
          label="已练题目"
          value={`${submitted}/${progress?.totalQuestions || 1115}`}
          metricLabel="完成均分"
          metricValue={
            progress?.completedAverageScore !== null && progress?.completedAverageScore !== undefined
              ? String(progress.completedAverageScore)
              : "--"
          }
        />
        <Stat
          icon={RotateCcw}
          label={progress?.reviewCount ? "复习提醒" : "复习清爽"}
          value={`${progress?.reviewCount || 0}`}
          detail={`累计复习 ${progress?.reviewedQuestionCount || 0} 题`}
          onClick={onStartReview}
          tone={progress?.reviewCount ? "review" : "calm"}
        />
      </section>

      <section className="map-section">
        <div className="section-title">
          <h2>闯关地图</h2>
          <span>4 季 · 224 天 · 1115 题</span>
        </div>
        <div className="season-stack">
          {seasons.map((season) => (
            <SeasonMap key={season.season} season={season} onStartDay={onStartDay} />
          ))}
        </div>
      </section>
    </>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  detail,
  metricLabel,
  metricValue,
  onClick,
  tone
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  detail?: string;
  metricLabel?: string;
  metricValue?: string;
  onClick?: () => void;
  tone?: "review" | "calm";
}) {
  const metricNumber = metricValue ? Number(metricValue) : Number.NaN;
  const metricPercent = Number.isFinite(metricNumber) ? Math.max(0, Math.min(100, metricNumber)) : 0;
  const content = (
    <>
      <div className="stat-main">
        <span>
          <Icon size={22} />
        </span>
        <p>{label}</p>
        <strong>{value}</strong>
        {detail ? <small className="stat-detail">{detail}</small> : null}
      </div>
      {metricLabel && metricValue ? (
        <div
          className={`stat-metric ${Number.isFinite(metricNumber) ? "" : "empty"}`}
          style={{ "--metric-score": `${metricPercent}%` } as React.CSSProperties}
          aria-label={`${metricLabel} ${metricValue}`}
        >
          <div className="stat-metric-ring">
            <ScoreMoodFace score={Number.isFinite(metricNumber) ? metricNumber : null} />
            <strong>{metricValue}</strong>
          </div>
          <small>{metricLabel}</small>
        </div>
      ) : null}
    </>
  );

  return onClick ? (
    <button className={`stat-card stat-button ${metricLabel ? "has-metric" : ""} ${tone || ""}`} onClick={onClick}>
      {content}
    </button>
  ) : (
    <div className={`stat-card ${metricLabel ? "has-metric" : ""}`}>
      {content}
    </div>
  );
}

function ScoreMoodFace({ score }: { score: number | null }) {
  if (score === null) {
    return (
      <svg className="score-mood-face empty" viewBox="0 0 64 64" aria-hidden="true">
        <circle cx="32" cy="32" r="28" />
        <path d="M22 32H42" />
      </svg>
    );
  }

  if (score >= 90) {
    return (
      <svg className="score-mood-face excellent" viewBox="0 0 64 64" aria-hidden="true">
        <circle cx="32" cy="32" r="28" />
        <path d="M17 24C17 16 28 16 28 24" />
        <path d="M36 24C36 16 47 16 47 24" />
        <path
          className="mouth"
          d="M14 34C16 24 24 24 31 31C39 24 50 25 51 35C53 46 44 55 32 55C20 55 12 45 14 34Z"
        />
        <path className="tongue" d="M27 50C33 45 42 45 48 49C44 53 38 55 32 55C29 55 27 53 27 50Z" />
      </svg>
    );
  }

  if (score >= 80) {
    return (
      <svg className="score-mood-face good" viewBox="0 0 64 64" aria-hidden="true">
        <circle cx="32" cy="32" r="28" />
        <path d="M21 8C15 14 24 18 18 24" />
        <path d="M30 8C24 14 33 18 27 24" />
        <path d="M39 8C33 14 42 18 36 24" />
        <circle className="eye-white" cx="21" cy="28" r="7" />
        <circle className="eye-white" cx="43" cy="28" r="7" />
        <circle className="pupil" cx="21" cy="28" r="3" />
        <circle className="pupil" cx="43" cy="28" r="3" />
        <path d="M22 43C27 51 39 51 44 43" />
      </svg>
    );
  }

  if (score >= 60) {
    return (
      <svg className="score-mood-face effort" viewBox="0 0 64 64" aria-hidden="true">
        <circle cx="32" cy="32" r="28" />
        <ellipse className="eye-white" cx="21" cy="29" rx="12" ry="7" />
        <ellipse className="eye-white" cx="43" cy="29" rx="12" ry="7" />
        <rect className="pupil" x="20" y="22" width="5" height="14" rx="2.5" />
        <rect className="pupil" x="39" y="22" width="5" height="14" rx="2.5" />
        <path d="M20 47C25 38 39 38 44 47" />
      </svg>
    );
  }

  return (
    <svg className="score-mood-face retry" viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="32" r="28" />
      <path d="M23 9C17 16 24 20 19 27" />
      <path d="M32 9C26 16 33 20 28 27" />
      <path d="M41 9C35 16 42 20 37 27" />
      <ellipse className="eye-white" cx="21" cy="34" rx="11" ry="6" />
      <ellipse className="eye-white" cx="43" cy="34" rx="11" ry="6" />
      <circle className="pupil" cx="22" cy="33" r="5" />
      <circle className="pupil" cx="42" cy="33" r="5" />
      <path d="M23 51C29 46 36 46 42 51" />
    </svg>
  );
}

function SeasonMap({ season, onStartDay }: { season: SeasonCatalog; onStartDay: (day: { season: number; day: number }) => void }) {
  return (
    <article className="season-map">
      <div className="season-header">
        <h3>第 {season.season} 季</h3>
        <span>
          {season.dayCount} 天 · {season.questionCount} 题
        </span>
      </div>
      <div className="day-grid">
        {season.days.map((day) => {
          const status = day.needsReview ? "review" : day.completed ? "done" : day.submitted > 0 ? "active" : "fresh";
          return (
            <button
              key={day.day}
              className={`day-node ${status}`}
              onClick={() => onStartDay({ season: season.season, day: day.day })}
              title={`S${season.season} Day ${day.day}`}
            >
              {day.latestAverageScore !== null ? <em>{day.latestAverageScore}</em> : null}
              <span>{day.completed ? <Check size={18} /> : day.day}</span>
              <small>{day.attemptCount > 0 ? `${day.attemptCount}次` : `${day.submitted}/${day.questionCount}`}</small>
            </button>
          );
        })}
      </div>
    </article>
  );
}

function PracticeScreen({ season, day, onBack }: { season: number; day: number; onBack: () => void }) {
  const [questions, setQuestions] = useState<PublicQuestion[]>([]);
  const [current, setCurrent] = useState(0);
  const [answer, setAnswer] = useState("");
  const [grade, setGrade] = useState<Grade | null>(null);
  const [attemptId, setAttemptId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    setCurrent(0);
    setAnswer("");
    setGrade(null);
    setAttemptId(null);
    setError("");
    Promise.all([
      api(`/api/days/${season}/${day}/questions`),
      api("/api/day-attempts/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ season, day })
      })
    ])
      .then(([questionData, attemptData]) => {
        const loadedQuestions = questionData.questions as PublicQuestion[];
        const submittedQuestionNos = new Set<number>(attemptData.submittedQuestionNos || []);
        const nextQuestionIndex = loadedQuestions.findIndex((item) => !submittedQuestionNos.has(item.questionNo));
        setQuestions(loadedQuestions);
        setAttemptId(attemptData.attemptId);
        setCurrent(nextQuestionIndex === -1 ? loadedQuestions.length : nextQuestionIndex);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "题目加载失败"))
      .finally(() => setLoading(false));
  }, [season, day]);

  const question = questions[current];
  const complete = questions.length > 0 && current >= questions.length;

  async function submit() {
    if (!question || !answer.trim()) return;
    setSubmitting(true);
    setError("");
    try {
      const response = await api("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId: question.id, answer, attemptId, mode: "day" })
      });
      setGrade(response.grade);
    } catch (err) {
      setError(err instanceof Error ? err.message : "提交失败");
    } finally {
      setSubmitting(false);
    }
  }

  function next() {
    setAnswer("");
    setGrade(null);
    setCurrent((value) => value + 1);
  }

  return (
    <main className="practice-shell">
      <header className="practice-header">
        <button className="soft-button" onClick={onBack}>
          返回地图
        </button>
        <div>
          <strong>S{season} Day {day}</strong>
          <span>{Math.min(current + 1, questions.length)}/{questions.length || 0}</span>
        </div>
      </header>

      {loading ? <LoadingScreen compact /> : null}
      {error ? <div className="notice danger">{error}</div> : null}

      {complete ? (
        <section className="finish-card">
          <Trophy size={56} />
          <h1>Day {day} 完成啦</h1>
          <p>今天的句子都练过了，可以回地图看看下一关。</p>
          <button className="primary-button" onClick={onBack}>
            <Flag size={20} />
            回到闯关地图
          </button>
        </section>
      ) : question ? (
        <section className="question-card">
          <div className="question-topline">
            <span>第 {question.questionNo} 题</span>
            <b>{question.prompt}</b>
          </div>
          <h1>{question.chinese}</h1>
          <textarea
            value={answer}
            onChange={(event) => setAnswer(event.target.value)}
            placeholder="在这里输入你的英文句子..."
            disabled={Boolean(grade)}
          />
          {!grade ? (
            <button className="primary-button submit" onClick={submit} disabled={submitting || !answer.trim()}>
              {submitting ? <Loader2 className="spin" size={20} /> : <Sparkles size={20} />}
              提交批改
            </button>
          ) : (
            <Feedback grade={grade} onNext={next} isLast={current === questions.length - 1} />
          )}
          {submitting ? <GradingOverlay /> : null}
        </section>
      ) : null}
    </main>
  );
}

function ReviewCenter({ onBack, onStartPractice }: { onBack: () => void; onStartPractice: () => void }) {
  const [history, setHistory] = useState<ReviewHistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"questions" | "records">("questions");
  const [expandedQuestion, setExpandedQuestion] = useState<string | null>(null);

  useEffect(() => {
    api("/api/review/history")
      .then((data) => setHistory(data))
      .catch((err) => setError(err instanceof Error ? err.message : "复习历史加载失败"))
      .finally(() => setLoading(false));
  }, []);

  const summary = history?.summary;
  const currentReviewCount = summary?.currentReviewCount || 0;

  return (
    <main className="practice-shell">
      <header className="practice-header">
        <button className="soft-button" onClick={onBack}>
          返回地图
        </button>
        <div>
          <strong>复习中心</strong>
          <span>{currentReviewCount} 题待复习</span>
        </div>
      </header>

      {loading ? <LoadingScreen compact /> : null}
      {error ? <div className="notice danger">{error}</div> : null}

      {!loading && history ? (
        <>
          <section className={`review-center-card ${currentReviewCount ? "has-review" : "clear"}`}>
            <div className="review-hero-number">
              <strong>{currentReviewCount}</strong>
              <span>当前需复习</span>
            </div>
            <div className="review-center-main">
              <h1>{currentReviewCount ? "先把这些题捡回来" : "今天错题篮很清爽"}</h1>
              <p>
                累计复习过 {summary?.reviewedQuestionCount || 0} 题，已经掌握 {summary?.reviewMasteredQuestionCount || 0} 题。
              </p>
              <div className="review-actions">
                <button className="primary-button" onClick={onStartPractice} disabled={currentReviewCount === 0}>
                  <RotateCcw size={20} />
                  {currentReviewCount ? "开始复习" : "暂无需要复习"}
                </button>
                <button className="soft-button" onClick={() => setTab("questions")}>
                  <History size={18} />
                  查看历史
                </button>
              </div>
            </div>
          </section>

          <section className="review-summary-grid">
            <ReviewMetric icon={ListChecks} label="累计复习题" value={summary?.reviewedQuestionCount || 0} />
            <ReviewMetric icon={CheckCircle2} label="已掌握题" value={summary?.reviewMasteredQuestionCount || 0} />
            <ReviewMetric icon={Star} label="复习提交" value={summary?.reviewSubmissionCount || 0} />
          </section>

          <section className="review-history-panel">
            <div className="review-tabs">
              <button className={tab === "questions" ? "active" : ""} onClick={() => setTab("questions")}>
                按题目
              </button>
              <button className={tab === "records" ? "active" : ""} onClick={() => setTab("records")}>
                按记录
              </button>
            </div>

            {tab === "questions" ? (
              <div className="history-list">
                {history.questions.length ? (
                  history.questions.map((question) => {
                    const expanded = expandedQuestion === question.id;
                    return (
                      <button
                        key={question.id}
                        className={`history-card ${question.latestReviewMastered ? "mastered" : "review"} ${expanded ? "expanded" : ""}`}
                        onClick={() => setExpandedQuestion(expanded ? null : question.id)}
                      >
                        <div className="history-card-top">
                          <span>S{question.season} Day {question.day} · 第 {question.questionNo} 题</span>
                          <b>{question.latestReviewMastered ? "已掌握" : "继续练"}</b>
                          {question.currentlyNeedsReview ? <em>当前需复习</em> : null}
                        </div>
                        <p className="history-question">{question.chinese}</p>
                        <div className="history-meta">
                          <span>{question.prompt}</span>
                          <span>{question.reviewCount} 次</span>
                        </div>
                        <ScoreTrail attempts={question.attempts} threshold={history.threshold} />
                        {question.attempts.length > 1 ? <small className="trail-caption">从左到右是每次复习分数</small> : null}
                        {question.currentlyNeedsReview ? <small className="trail-caption alert">最新总分 {question.currentScore}，当前又进入复习</small> : null}
                        {question.attempts.length === 1 && !question.currentlyNeedsReview ? (
                          <small className="trail-caption">目前只有 1 次复习记录</small>
                        ) : null}
                        {expanded ? (
                          <div className="history-detail">
                            <p><b>最近答案：</b>{question.latestAnswer}</p>
                            <p><b>参考：</b>{question.referenceAnswer}</p>
                            {question.latestIssues.length ? <p><b>问题：</b>{question.latestIssues.join("；")}</p> : null}
                            <small>{formatDate(question.latestReviewAt)}</small>
                          </div>
                        ) : null}
                      </button>
                    );
                  })
                ) : (
                  <EmptyHistory />
                )}
              </div>
            ) : (
              <div className="history-list">
                {history.records.length ? (
                  history.records.map((record, index) => (
                    <article key={`${record.questionNo}-${record.submittedAt}-${index}`} className={`history-card ${record.mastered ? "mastered" : "review"}`}>
                      <div className="history-card-top">
                        <span>S{record.season} Day {record.day} · 第 {record.questionNo} 题</span>
                        <b>{record.mastered ? "已掌握" : "继续练"}</b>
                      </div>
                      <p className="history-question">{record.chinese}</p>
                      <div className="history-meta">
                        <span>{record.prompt}</span>
                        <span>{record.score} 分</span>
                        <span>{formatDate(record.submittedAt)}</span>
                      </div>
                      <div className="history-detail visible">
                        <p><b>答案：</b>{record.answer}</p>
                        {record.issues.length ? <p><b>问题：</b>{record.issues.join("；")}</p> : <p><b>反馈：</b>{record.suggestion}</p>}
                      </div>
                    </article>
                  ))
                ) : (
                  <EmptyHistory />
                )}
              </div>
            )}
          </section>
        </>
      ) : null}
    </main>
  );
}

function ReviewMetric({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: number }) {
  return (
    <div className="review-metric">
      <Icon size={20} />
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ScoreTrail({ attempts, threshold }: { attempts: Array<{ score: number; submittedAt: string }>; threshold: number }) {
  return (
    <div className="score-trail" aria-label="复习分数轨迹">
      {attempts.map((attempt, index) => {
        const latest = index === attempts.length - 1;
        const mastered = attempt.score >= threshold;
        return (
          <React.Fragment key={`${attempt.submittedAt}-${index}`}>
            {index > 0 ? <span className="score-joiner">→</span> : null}
            <span
              className={`score-pill ${mastered ? "mastered" : "review"} ${latest ? "latest" : ""}`}
              title={formatDate(attempt.submittedAt)}
            >
              {attempt.score}
            </span>
          </React.Fragment>
        );
      })}
    </div>
  );
}

function EmptyHistory() {
  return (
    <div className="empty-history">
      <Trophy size={42} />
      <h2>还没有复习历史</h2>
      <p>低分题复习后，这里会留下记录。</p>
    </div>
  );
}

function ReviewScreen({ onBack }: { onBack: () => void }) {
  const [questions, setQuestions] = useState<ReviewQuestion[]>([]);
  const [current, setCurrent] = useState(0);
  const [answer, setAnswer] = useState("");
  const [grade, setGrade] = useState<Grade | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [needsMorePractice, setNeedsMorePractice] = useState(0);
  const [masteredThisRound, setMasteredThisRound] = useState(0);
  const [threshold, setThreshold] = useState(80);

  useEffect(() => {
    api("/api/review")
      .then((data) => {
        setThreshold(data.threshold || 80);
        setQuestions(data.questions);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "复习题加载失败"))
      .finally(() => setLoading(false));
  }, []);

  const question = questions[current];
  const complete = !loading && questions.length > 0 && current >= questions.length;
  const empty = !loading && questions.length === 0;

  async function submit() {
    if (!question || !answer.trim()) return;
    setSubmitting(true);
    setError("");
    try {
      const response = await api("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId: question.id, answer, mode: "review" })
      });
      setGrade(response.grade);
    } catch (err) {
      setError(err instanceof Error ? err.message : "提交失败");
    } finally {
      setSubmitting(false);
    }
  }

  function next() {
    if (grade && grade.score < threshold) {
      setNeedsMorePractice((value) => value + 1);
    } else if (grade) {
      setMasteredThisRound((value) => value + 1);
    }
    setAnswer("");
    setGrade(null);
    setCurrent((value) => value + 1);
  }

  return (
    <main className="practice-shell">
      <header className="practice-header">
        <button className="soft-button" onClick={onBack}>
          返回地图
        </button>
        <div>
          <strong>错题复习</strong>
          <span>{empty ? "0/0" : `${Math.min(current + 1, questions.length)}/${questions.length}`}</span>
        </div>
      </header>

      {loading ? <LoadingScreen compact /> : null}
      {error ? <div className="notice danger">{error}</div> : null}

      {empty ? (
        <section className="finish-card">
          <Trophy size={56} />
          <h1>暂无需要复习的题</h1>
          <p>低于 {threshold} 分的题会自动出现在这里。</p>
          <button className="primary-button" onClick={onBack}>
            <Flag size={20} />
            回到闯关地图
          </button>
        </section>
      ) : complete ? (
        <section className="finish-card">
          <Trophy size={56} />
          <h1>{needsMorePractice === 0 ? "复习提醒清空啦" : "本轮复习完成"}</h1>
          <p>
            {needsMorePractice === 0
              ? `本轮复习了 ${questions.length} 题，掌握 ${masteredThisRound} 题，仍需继续练 0 题。`
              : `本轮复习了 ${questions.length} 题，掌握 ${masteredThisRound} 题，仍需继续练 ${needsMorePractice} 题。`}
          </p>
          <button className="primary-button" onClick={onBack}>
            <Flag size={20} />
            回到闯关地图
          </button>
        </section>
      ) : question ? (
        <section className="question-card">
          <div className="question-topline">
            <span>S{question.season} Day {question.day} · 第 {question.questionNo} 题</span>
            <b>{question.prompt}</b>
          </div>
          <div className="review-hint">
            <strong>上次 {question.lastScore} 分</strong>
            {question.lastIssues.length ? (
              <ul>
                {question.lastIssues.map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
            ) : (
              <p>这次重点检查提示词、句子主干和时态。</p>
            )}
          </div>
          <h1>{question.chinese}</h1>
          <textarea
            value={answer}
            onChange={(event) => setAnswer(event.target.value)}
            placeholder="重新写一遍，让这题过关..."
            disabled={Boolean(grade)}
          />
          {!grade ? (
            <button className="primary-button submit" onClick={submit} disabled={submitting || !answer.trim()}>
              {submitting ? <Loader2 className="spin" size={20} /> : <Sparkles size={20} />}
              提交复习
            </button>
          ) : (
            <Feedback
              grade={grade}
              onNext={next}
              isLast={current === questions.length - 1}
              nextLabel={
                current === questions.length - 1
                  ? "完成复习"
                  : grade.score >= threshold
                    ? "已掌握，下一题"
                    : "继续练下一题"
              }
            />
          )}
          {submitting ? <GradingOverlay /> : null}
        </section>
      ) : null}
    </main>
  );
}

function WordPracticeScreen({
  initialMode,
  onBack,
  embedded = false
}: {
  initialMode: "new" | "review";
  onBack: () => void;
  embedded?: boolean;
}) {
  const [catalog, setCatalog] = useState<WordCatalog | null>(null);
  const [progress, setProgress] = useState<WordProgress | null>(null);
  const [levelGroups, setLevelGroups] = useState<WordLevelGroup[]>([]);
  const [activeLevelId, setActiveLevelId] = useState<string | null>(null);
  const [batchSize, setBatchSize] = useState(5);
  const [tag, setTag] = useState(DEFAULT_WORD_SCOPE_TAG);
  const [mode, setMode] = useState<"new" | "review">(initialMode);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [words, setWords] = useState<WordPrompt[]>([]);
  const [current, setCurrent] = useState(0);
  const [wordAnswer, setWordAnswer] = useState("");
  const [meaningAnswers, setMeaningAnswers] = useState<Record<string, string>>({});
  const [wordGrade, setWordGrade] = useState<Grade | null>(null);
  const [exampleAnswer, setExampleAnswer] = useState("");
  const [exampleGrade, setExampleGrade] = useState<Grade | null>(null);
  const [details, setDetails] = useState<WordDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    Promise.all([api("/api/word/catalog"), api("/api/word/progress"), api("/api/word/settings"), api("/api/word/levels")])
      .then(async ([catalogData, progressData, settingsData, levelData]) => {
        if (!mounted) return;
        setCatalog(catalogData);
        setProgress(progressData);
        setLevelGroups(levelData.groups || []);
        setBatchSize(settingsData.batchSize || 5);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "词汇练习加载失败"))
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, []);

  const word = words[current];
  const threshold = progress?.threshold || 80;
  const wordPassed = Boolean(wordGrade && wordGrade.score >= threshold);
  const practiceStarted = Boolean(sessionId);
  const reviewing = mode === "review";
  const wordMasteredPercent = ((progress?.masteredWords || 0) / (progress?.totalWords || 1650)) * 100;
  const wordMasteredPercentLabel =
    wordMasteredPercent > 0 && wordMasteredPercent < 1 ? `${wordMasteredPercent.toFixed(1)}%` : `${Math.round(wordMasteredPercent)}%`;
  const complete = !loading && practiceStarted && words.length > 0 && current >= words.length;
  const empty = !loading && practiceStarted && words.length === 0;

  async function startSession(nextMode = mode, nextTag = tag, nextLevelId: string | null = null) {
    setError("");
    setCurrent(0);
    resetWordState();
    try {
      const data = await api("/api/word-sessions/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: nextMode, tag: nextTag, levelId: nextLevelId })
      });
      setSessionId(data.sessionId);
      const loadedWords = data.words || [];
      const resume = data.resume as WordSessionResume | null;
      setWords(loadedWords);
      setMode(nextMode);
      setTag(nextTag);
      setActiveLevelId(data.levelId || nextLevelId);
      if (resume) {
        setCurrent(Math.max(0, Math.min(loadedWords.length, resume.itemNo - 1)));
        if (resume.phase === "example" && resume.wordGrade) {
          setWordAnswer(resume.wordAnswer || resume.details?.name || "");
          setMeaningAnswers(resume.meaningAnswers || {});
          setWordGrade(resume.wordGrade);
          setDetails(resume.details || null);
        } else if (resume.phase === "complete") {
          setCurrent(loadedWords.length);
        }
      }
    } catch (err) {
      setSessionId(null);
      setWords([]);
      setError(err instanceof Error ? err.message : "词汇练习开始失败");
    }
  }

  async function refreshWordProgress() {
    try {
      const [progressData, levelData] = await Promise.all([api("/api/word/progress"), api("/api/word/levels")]);
      setProgress(progressData);
      setLevelGroups(levelData.groups || []);
    } catch {
      // Keep the current practice flow uninterrupted if the summary refresh fails.
    }
  }

  function resetWordState() {
    setWordAnswer("");
    setMeaningAnswers({});
    setWordGrade(null);
    setExampleAnswer("");
    setExampleGrade(null);
    setDetails(null);
  }

  async function playWordAudio() {
    if (!word) return;
    setError("");
    try {
      await playWordAudioById(word.id);
    } catch {
      setError("发音播放失败，可以再点一次试试。");
    }
  }

  async function submitWord() {
    if (!word || !wordAnswer.trim()) return;
    setSubmitting(true);
    setError("");
    try {
      const response = await api("/api/word-submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          wordId: word.id,
          phase: "word",
          wordAnswer,
          meaningAnswers
        })
      });
      setWordGrade(response.grade);
      setDetails(response.details);
      await refreshWordProgress();
    } catch (err) {
      setError(err instanceof Error ? err.message : "提交失败");
    } finally {
      setSubmitting(false);
    }
  }

  async function submitExample() {
    if (!word || !exampleAnswer.trim()) return;
    setSubmitting(true);
    setError("");
    try {
      const response = await api("/api/word-submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          wordId: word.id,
          phase: "example",
          answer: exampleAnswer
        })
      });
      setExampleGrade(response.grade);
      setDetails(response.details);
      await refreshWordProgress();
    } catch (err) {
      setError(err instanceof Error ? err.message : "提交失败");
    } finally {
      setSubmitting(false);
    }
  }

  function nextWord() {
    resetWordState();
    setCurrent((value) => value + 1);
  }

  async function returnToWordMap() {
    setSessionId(null);
    setWords([]);
    setCurrent(0);
    setActiveLevelId(null);
    resetWordState();
    await refreshWordProgress();
  }

  return (
    <section className={embedded ? "word-practice-shell embedded" : "practice-shell word-practice-shell"}>
      {!embedded ? (
        <header className="practice-header">
          <button className="soft-button" onClick={onBack}>
            返回地图
          </button>
          <div>
            <strong>上海初中英语考纲词汇</strong>
            <span>{mode === "review" ? "词汇复习" : `每次 ${batchSize} 词`}</span>
          </div>
        </header>
      ) : (
        <header className="word-home-header hero-band">
          <div>
            <span className="eyebrow">
              <BookOpen size={16} />
              上海初中英语考纲词汇
            </span>
            <h1>听发音，默写单词和例句</h1>
            <p className="word-hero-sub">
              已掌握 {progress?.masteredWords || 0} / {progress?.totalWords || 1650} 个词
              {progress?.reviewWords ? ` · 待复习 ${progress.reviewWords} 个` : ""}
            </p>
            {progress?.reviewWords ? (
              <button className="primary-button wide review" onClick={() => startSession("review", tag, null)}>
                <RotateCcw size={20} />
                复习错词 {progress.reviewWords}
                <ArrowRight size={20} />
              </button>
            ) : null}
          </div>
          <div
            className="progress-ring word-progress-ring"
            style={{ "--progress": `${wordMasteredPercent}%` } as React.CSSProperties}
          >
            <strong>{wordMasteredPercentLabel}</strong>
            <span>已掌握</span>
          </div>
        </header>
      )}

      {loading ? <LoadingScreen compact /> : null}
      {error ? <div className="notice danger">{error}</div> : null}

      {!loading && !practiceStarted && levelGroups.length ? (
        <WordLevelMap
          groups={levelGroups}
          activeLevelId={activeLevelId}
          onSelect={(levelId) => startSession("new", tag, levelId)}
        />
      ) : null}

      {!loading && !practiceStarted && !levelGroups.length ? (
        <section className="finish-card">
          <Trophy size={56} />
          <h1>词汇闯关表加载失败</h1>
          <p>稍后刷新页面再试。</p>
        </section>
      ) : null}

      {empty ? (
        <section className="finish-card">
          <Trophy size={56} />
          <h1>这一关暂时没有可练习的词</h1>
          <p>回到词汇闯关表，换一关继续。</p>
          <button className="primary-button" onClick={returnToWordMap}>
            <Flag size={20} />
            回到词汇闯关表
          </button>
        </section>
      ) : complete ? (
        <section className="finish-card">
          <Trophy size={56} />
          <h1>这一关练完啦</h1>
          <p>
            已掌握 {progress?.masteredWords || 0} 个词，待复习 {progress?.reviewWords || 0} 个词。
          </p>
          <button className="primary-button" onClick={returnToWordMap}>
            <Flag size={20} />
            回到词汇闯关表
          </button>
        </section>
      ) : word ? (
        <section className="question-card word-card">
          <div className="question-topline">
            <span>
              {reviewing ? "错词复习" : activeLevelId?.toUpperCase()}
              {reviewing && activeLevelId ? ` · ${activeLevelId.toUpperCase()}` : ""} · 第 {word.itemNo} 个词
            </span>
            <b>{Math.min(current + 1, words.length)}/{words.length}</b>
          </div>

          <div className="word-audio-row">
            <button className="audio-button" onClick={playWordAudio} title="播放发音" disabled={submitting}>
              <Volume2 size={30} />
            </button>
            <div className="word-audio-text">
              <p>听发音，默写英文单词和中文意思</p>
              <strong>{details?.name || "?????"}</strong>
              {details?.phonetics.length ? <small>{formatPhonetics(details.phonetics)}</small> : null}
            </div>
          </div>

          <div className="word-field">
            <span className="word-field-label">① 英文单词</span>
            <input
              className="word-input"
              value={wordAnswer}
              onChange={(event) => setWordAnswer(event.target.value)}
              disabled={Boolean(wordGrade)}
            />
          </div>

          <div className="word-field">
            <span className="word-field-label">② 中文意思</span>
            <div className="word-meaning-grid">
              {word.partsOfSpeech.map((part) => (
                <label key={part}>
                  <span className="word-pos-badge">{part}</span>
                  <input
                    value={meaningAnswers[part] || ""}
                    onChange={(event) => setMeaningAnswers((value) => ({ ...value, [part]: event.target.value }))}
                    placeholder="写出核心中文意思"
                    disabled={Boolean(wordGrade)}
                  />
                </label>
              ))}
            </div>
          </div>

          {!wordGrade ? (
            <button className="primary-button submit" onClick={submitWord} disabled={submitting || !wordAnswer.trim()}>
              {submitting ? <Loader2 className="spin" size={20} /> : <Sparkles size={20} />}
              提交单词批改
            </button>
          ) : (
            <Feedback
              grade={wordGrade}
              onNext={nextWord}
              isLast={current === words.length - 1}
              nextLabel={wordPassed ? "继续例句" : current === words.length - 1 ? "完成这一组" : "下一词"}
              hideNext={wordPassed}
            />
          )}

          {wordPassed && details ? (
            <section className="example-panel">
              <div className="question-topline">
                <span>例句默写</span>
                <b>{threshold} 分过关</b>
              </div>
              <h1>{details.example.chinese}</h1>
              <textarea
                value={exampleAnswer}
                onChange={(event) => setExampleAnswer(event.target.value)}
                placeholder="默写英文例句..."
                disabled={Boolean(exampleGrade)}
              />
              {!exampleGrade ? (
                <button className="primary-button submit" onClick={submitExample} disabled={submitting || !exampleAnswer.trim()}>
                  {submitting ? <Loader2 className="spin" size={20} /> : <Sparkles size={20} />}
                  提交例句批改
                </button>
              ) : (
                <Feedback
                  grade={exampleGrade}
                  onNext={nextWord}
                  isLast={current === words.length - 1}
                  nextLabel={current === words.length - 1 ? "完成这一组" : "下一词"}
                />
              )}
            </section>
          ) : null}

          {submitting ? <GradingOverlay /> : null}
        </section>
      ) : null}

      {practiceStarted && word && !submitting ? (
        <div className="word-practice-back">
          <button className="soft-button" onClick={returnToWordMap}>
            返回词汇闯关表
          </button>
        </div>
      ) : null}
    </section>
  );
}

function WordLevelMap({
  groups,
  activeLevelId,
  onSelect
}: {
  groups: WordLevelGroup[];
  activeLevelId: string | null;
  onSelect: (levelId: string) => void;
}) {
  return (
    <section className="map-section word-map-section">
      <div className="section-title">
        <h2>词汇闯关表</h2>
        <span>A-Z 分组 · 5 词一关</span>
      </div>
      <div className="season-stack word-letter-stack">
        {groups.map((group) => (
          <article key={group.letter} className="season-map word-letter-map">
            <div className="season-header">
              <h3>{group.letter.toUpperCase()}</h3>
              <span>
                {group.masteredWords}/{group.totalWords} 个
                {group.reviewWords ? ` · 复习 ${group.reviewWords}` : ""}
              </span>
            </div>
            <div className="day-grid word-level-grid">
              {group.levels.map((level) => (
                <button
                  key={level.id}
                  className={`day-node word-level-node ${level.status} ${level.id === activeLevelId ? "selected" : ""}`}
                  onClick={() => onSelect(level.id)}
                  title={`${level.firstWord} - ${level.lastWord}`}
                >
                  {level.reviewCount ? <em>复</em> : null}
                  <span>{level.status === "done" ? <Check size={18} /> : level.levelNo}</span>
                  <small>
                    {level.masteredCount}/{level.wordCount}
                  </small>
                </button>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function GradingOverlay() {
  return (
    <div className="grading-overlay" role="status" aria-live="polite" aria-label="AI 批改中">
      <div className="grading-card">
        <div className="grading-orbit">
          <Sparkles size={30} />
          <span />
          <span />
          <span />
        </div>
        <strong>AI 批改中</strong>
        <p>正在认真看你的英文句子...</p>
        <div className="grading-dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
      </div>
    </div>
  );
}

function Feedback({
  grade,
  onNext,
  isLast,
  nextLabel,
  hideNext = false
}: {
  grade: Grade;
  onNext: () => void;
  isLast: boolean;
  nextLabel?: string;
  hideNext?: boolean;
}) {
  const isPerfect = grade.score === 100;

  return (
    <div className={`feedback ${grade.needsReview ? "review" : "great"}`}>
      <div className="score-bubble">
        <strong>{grade.score}</strong>
        <span>{grade.level}</span>
      </div>
      <div className="feedback-body">
        <h2>{grade.encouragement}</h2>
        {isPerfect ? (
          <p className="perfect-note"><b>太棒了：</b>{grade.suggestion}</p>
        ) : grade.issues.length ? (
          <ul>
            {grade.issues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        ) : null}
        {!isPerfect ? <p><b>建议：</b>{grade.suggestion}</p> : null}
        <p><b>参考：</b>{grade.referenceAnswer}</p>
        {!isPerfect ? <p><b>可改成：</b>{grade.improvedAnswer}</p> : null}
        {!hideNext ? (
          <button className="primary-button" onClick={onNext}>
            {nextLabel || (isLast ? "完成这一天" : "下一题")}
            <ArrowRight size={20} />
          </button>
        ) : null}
      </div>
    </div>
  );
}

function LoadingScreen({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? "loading compact" : "loading"}>
      <Loader2 className="spin" size={28} />
      <span>正在准备题目...</span>
    </div>
  );
}

// ---------------- Admin (后台管理) ----------------

type AdminQuestion = {
  id: string;
  season: number;
  day: number;
  questionNo: number;
  chinese: string;
  prompt: string;
  sourceText: string;
  referenceAnswer: string;
};

type AdminWordDefinition = { phonetic: string; partOfSpeech: string; meaning: string };
type AdminWordExample = { english: string; chinese: string };
type AdminWord = {
  id: string;
  name: string;
  definitions: AdminWordDefinition[];
  examples: AdminWordExample[];
  tags: string[];
  hasAudio: boolean;
};

type WordTag = { id: string; label: string; systemGenerated: boolean; count: number };

const ADMIN_PAGE_SIZE = 5;

const ALPHABET = "abcdefghijklmnopqrstuvwxyz".split("");

// 分类标签元信息。"all" 是隐式的"全部"，不作为可选/可编辑分类。
function useWordTags(): WordTag[] {
  const [tags, setTags] = useState<WordTag[]>([]);
  useEffect(() => {
    api("/api/admin/word-tags")
      .then((data) => setTags((data.tags as WordTag[]).filter((tag) => tag.id !== "all")))
      .catch(() => setTags([]));
  }, []);
  return tags;
}

function tagLabel(tags: WordTag[], id: string): string {
  return tags.find((tag) => tag.id === id)?.label || id;
}

type QuestionSeasonMeta = { season: number; questionCount: number; days: Array<{ day: number; questionCount: number }> };

function useQuestionMeta(): QuestionSeasonMeta[] {
  const [meta, setMeta] = useState<QuestionSeasonMeta[]>([]);
  useEffect(() => {
    api("/api/admin/question-meta")
      .then((data) => setMeta(data.seasons as QuestionSeasonMeta[]))
      .catch(() => setMeta([]));
  }, []);
  return meta;
}

// 中考常见词性。编辑已有单词时若原词性不在表内，临时并入，避免下拉丢失原值。
const PART_OF_SPEECH_OPTIONS = [
  "n.",
  "v.",
  "vt.",
  "vi.",
  "adj.",
  "adv.",
  "prep.",
  "conj.",
  "pron.",
  "art.",
  "num.",
  "int.",
  "aux.",
  "modal v.",
  "abbr."
];

function posOptions(current: string): string[] {
  if (current && !PART_OF_SPEECH_OPTIONS.includes(current)) {
    return [current, ...PART_OF_SPEECH_OPTIONS];
  }
  return PART_OF_SPEECH_OPTIONS;
}

function AdminLoginScreen({ onLogin, onCancel }: { onLogin: () => void; onCancel: () => void }) {
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await api("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password })
      });
      onLogin();
    } catch (err) {
      setError(err instanceof Error ? err.message : "登录失败");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-panel">
        <div className="login-mark">
          <Settings size={44} />
        </div>
        <h1>后台管理登录</h1>
        <p>输入管理员口令，管理题库与单词。</p>
        <form onSubmit={submit}>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="管理员口令"
            autoFocus
          />
          <button className="primary-button" disabled={submitting || !password}>
            {submitting ? <Loader2 className="spin" size={20} /> : <Settings size={20} />}
            进入后台
          </button>
        </form>
        <button className="link-button" onClick={onCancel}>
          返回练习
        </button>
        {error ? <div className="notice danger">{error}</div> : null}
      </section>
    </main>
  );
}

function AdminApp({ onExit }: { onExit: () => void }) {
  const [section, setSection] = useState<"questions" | "words">("questions");

  return (
    <main className="app-shell admin-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">
            <Settings size={22} />
          </span>
          <div>
            <p>后台管理</p>
            <strong>
              题库与单词
              <span className="app-version">{APP_VERSION}</span>
            </strong>
          </div>
        </div>
        <button className="icon-button" onClick={onExit} title="返回练习">
          <LogOut size={20} />
        </button>
      </header>
      <nav className="home-tabs" aria-label="管理类型">
        <button className={section === "questions" ? "active" : ""} onClick={() => setSection("questions")}>
          <Flag size={19} />
          中译英
        </button>
        <button className={section === "words" ? "active" : ""} onClick={() => setSection("words")}>
          <BookOpen size={19} />
          单词
        </button>
      </nav>
      {section === "questions" ? <AdminQuestions /> : <AdminWords />}
    </main>
  );
}

function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

function AdminQuestions() {
  const [items, setItems] = useState<AdminQuestion[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState("");
  const [seasonFilter, setSeasonFilter] = useState("");
  const [dayFilter, setDayFilter] = useState("");
  const debouncedSearch = useDebounced(search);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<AdminQuestion | "new" | null>(null);
  const [deleting, setDeleting] = useState<AdminQuestion | null>(null);
  const meta = useQuestionMeta();
  const dayOptions = seasonFilter ? meta.find((s) => String(s.season) === seasonFilter)?.days || [] : [];

  async function load() {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ limit: String(ADMIN_PAGE_SIZE), offset: String(offset) });
      if (debouncedSearch) params.set("q", debouncedSearch);
      if (seasonFilter) params.set("season", seasonFilter);
      if (dayFilter) params.set("day", dayFilter);
      const data = await api(`/api/admin/questions?${params.toString()}`);
      setItems(data.items);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, seasonFilter, dayFilter, offset]);

  useEffect(() => {
    setOffset(0);
  }, [debouncedSearch, seasonFilter, dayFilter]);

  return (
    <section className="admin-panel">
      <div className="admin-toolbar">
        <div className="admin-search">
          <Search size={18} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="搜索中文、提示词、答案或 ID"
          />
        </div>
        <select
          className="admin-filter"
          value={seasonFilter}
          onChange={(event) => {
            setSeasonFilter(event.target.value);
            setDayFilter("");
          }}
        >
          <option value="">全部 Season</option>
          {meta.map((s) => (
            <option key={s.season} value={s.season}>
              Season {s.season}（{s.questionCount}）
            </option>
          ))}
        </select>
        <select
          className="admin-filter"
          value={dayFilter}
          disabled={!seasonFilter}
          onChange={(event) => setDayFilter(event.target.value)}
        >
          <option value="">{seasonFilter ? "全部 Day" : "先选 Season"}</option>
          {dayOptions.map((d) => (
            <option key={d.day} value={d.day}>
              Day {d.day}（{d.questionCount}）
            </option>
          ))}
        </select>
        <button className="primary-button small" onClick={() => setEditing("new")}>
          <Plus size={18} />
          新建题目
        </button>
      </div>

      {error ? <div className="notice danger">{error}</div> : null}
      <p className="admin-count">共 {total} 道题目{loading ? "（加载中…）" : ""}</p>

      <div className="admin-list">
        {items.map((item) => (
          <article key={item.id} className="admin-row">
            <div className="admin-row-main">
              <span className="admin-tag">{`Season ${item.season} · Day ${item.day} · Question ${item.questionNo}`}</span>
              <p className="admin-cn">{item.chinese}</p>
              {item.prompt ? <p className="admin-sub">提示词：{item.prompt}</p> : null}
              <p className="admin-ans">参考：{item.referenceAnswer}</p>
            </div>
            <div className="admin-row-actions">
              <button className="icon-button" title="编辑" onClick={() => setEditing(item)}>
                <Pencil size={18} />
              </button>
              <button className="icon-button danger" title="删除" onClick={() => setDeleting(item)}>
                <Trash2 size={18} />
              </button>
            </div>
          </article>
        ))}
        {!loading && items.length === 0 ? <p className="admin-empty">没有匹配的题目。</p> : null}
      </div>

      <AdminPager total={total} offset={offset} onOffset={setOffset} />

      {editing ? (
        <AdminQuestionForm
          question={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      ) : null}

      {deleting ? (
        <AdminDeleteConfirm
          label={`题目 ${deleting.id}`}
          deleteUrl={`/api/admin/questions/${encodeURIComponent(deleting.id)}`}
          onClose={() => setDeleting(null)}
          onDeleted={() => {
            setDeleting(null);
            load();
          }}
        />
      ) : null}
    </section>
  );
}

function AdminQuestionForm({
  question,
  onClose,
  onSaved
}: {
  question: AdminQuestion | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isNew = !question;
  const [season, setSeason] = useState(question ? String(question.season) : "");
  const [day, setDay] = useState(question ? String(question.day) : "");
  const [questionNo, setQuestionNo] = useState(question ? String(question.questionNo) : "");
  const [chinese, setChinese] = useState(question?.chinese || "");
  const [prompt, setPrompt] = useState(question?.prompt || "");
  const [referenceAnswer, setReferenceAnswer] = useState(question?.referenceAnswer || "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      if (isNew) {
        await api("/api/admin/questions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            season: Number(season),
            day: Number(day),
            questionNo: Number(questionNo),
            chinese,
            prompt,
            referenceAnswer
          })
        });
      } else {
        await api(`/api/admin/questions/${encodeURIComponent(question.id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chinese, prompt, referenceAnswer })
        });
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AdminModal title={isNew ? "新建题目" : `编辑 ${question.id}`} onClose={onClose}>
      <form className="admin-form" onSubmit={submit}>
        {isNew ? (
          <div className="admin-form-grid">
            <label>
              Season
              <input type="number" value={season} onChange={(e) => setSeason(e.target.value)} required />
            </label>
            <label>
              Day
              <input type="number" value={day} onChange={(e) => setDay(e.target.value)} required />
            </label>
            <label>
              题号
              <input type="number" value={questionNo} onChange={(e) => setQuestionNo(e.target.value)} required />
            </label>
          </div>
        ) : (
          <div className="admin-meta-row">
            <div className="admin-meta-item">
              <span className="admin-meta-label">Season</span>
              <span className="admin-meta-value">{season}</span>
            </div>
            <div className="admin-meta-item">
              <span className="admin-meta-label">Day</span>
              <span className="admin-meta-value">{day}</span>
            </div>
            <div className="admin-meta-item">
              <span className="admin-meta-label">题号</span>
              <span className="admin-meta-value">{questionNo}</span>
            </div>
          </div>
        )}
        {!isNew ? <p className="admin-hint">Season / Day / 题号决定题目 ID，不可修改；如需调整请删除后重建。</p> : null}
        <label>
          中文题目
          <textarea value={chinese} onChange={(e) => setChinese(e.target.value)} rows={2} required />
        </label>
        <label>
          提示词（可选）
          <input value={prompt} onChange={(e) => setPrompt(e.target.value)} />
        </label>
        <label>
          参考英文答案
          <textarea value={referenceAnswer} onChange={(e) => setReferenceAnswer(e.target.value)} rows={2} required />
        </label>
        {error ? <div className="notice danger">{error}</div> : null}
        <div className="admin-form-actions">
          <button type="button" className="link-button" onClick={onClose}>
            取消
          </button>
          <button className="primary-button small" disabled={submitting}>
            {submitting ? <Loader2 className="spin" size={18} /> : <Check size={18} />}
            保存
          </button>
        </div>
      </form>
    </AdminModal>
  );
}

function AdminWords() {
  const [items, setItems] = useState<AdminWord[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [letterFilter, setLetterFilter] = useState("");
  const debouncedSearch = useDebounced(search);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<AdminWord | "new" | null>(null);
  const [deleting, setDeleting] = useState<AdminWord | null>(null);
  const wordTags = useWordTags();

  async function load() {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ limit: String(ADMIN_PAGE_SIZE), offset: String(offset) });
      if (debouncedSearch) params.set("q", debouncedSearch);
      if (tagFilter) params.set("tag", tagFilter);
      if (letterFilter) params.set("letter", letterFilter);
      const data = await api(`/api/admin/words?${params.toString()}`);
      setItems(data.items);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, tagFilter, letterFilter, offset]);

  useEffect(() => {
    setOffset(0);
  }, [debouncedSearch, tagFilter, letterFilter]);

  return (
    <section className="admin-panel">
      <div className="admin-toolbar">
        <div className="admin-search">
          <Search size={18} />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索单词或释义" />
        </div>
        <select className="admin-filter" value={tagFilter} onChange={(event) => setTagFilter(event.target.value)}>
          <option value="">全部分类</option>
          {wordTags.map((tag) => (
            <option key={tag.id} value={tag.id}>
              {tag.label}（{tag.count}）
            </option>
          ))}
        </select>
        <button className="primary-button small" onClick={() => setEditing("new")}>
          <Plus size={18} />
          新建单词
        </button>
      </div>

      <div className="admin-alpha-bar">
        <button
          className={`admin-alpha${letterFilter === "" ? " active" : ""}`}
          onClick={() => setLetterFilter("")}
        >
          全部
        </button>
        {ALPHABET.map((letter) => (
          <button
            key={letter}
            className={`admin-alpha${letterFilter === letter ? " active" : ""}`}
            onClick={() => setLetterFilter((prev) => (prev === letter ? "" : letter))}
          >
            {letter.toUpperCase()}
          </button>
        ))}
      </div>

      {error ? <div className="notice danger">{error}</div> : null}
      <p className="admin-count">
        {letterFilter ? `首字母 ${letterFilter.toUpperCase()} · ` : ""}共 {total} 个单词{loading ? "（加载中…）" : ""}
      </p>

      <div className="admin-list">
        {items.map((item) => (
          <article key={item.id} className="admin-row">
            <div className="admin-row-main">
              <p className="admin-cn">
                {item.name}
                {item.hasAudio ? (
                  <button
                    type="button"
                    className="admin-audio-button"
                    title="试听发音"
                    onClick={() => {
                      playWordAudioById(item.id).catch(() => {});
                    }}
                  >
                    <Volume2 size={15} className="admin-audio" />
                  </button>
                ) : null}
              </p>
              <p className="admin-sub">
                {item.definitions.map((d) => `${d.partOfSpeech || ""} ${d.meaning}`.trim()).join("；")}
              </p>
              {item.examples[0]?.english ? <p className="admin-ans">例：{item.examples[0].english}</p> : null}
              {item.tags.filter((t) => t !== "all").length ? (
                <div className="admin-tag-chips">
                  {item.tags
                    .filter((t) => t !== "all")
                    .map((t) => (
                      <span key={t} className={`admin-chip${t === "shanghai-zhongkao" ? " primary" : ""}`}>
                        {tagLabel(wordTags, t)}
                      </span>
                    ))}
                </div>
              ) : null}
            </div>
            <div className="admin-row-actions">
              <button className="icon-button" title="编辑" onClick={() => setEditing(item)}>
                <Pencil size={18} />
              </button>
              <button className="icon-button danger" title="删除" onClick={() => setDeleting(item)}>
                <Trash2 size={18} />
              </button>
            </div>
          </article>
        ))}
        {!loading && items.length === 0 ? <p className="admin-empty">没有匹配的单词。</p> : null}
      </div>

      <AdminPager total={total} offset={offset} onOffset={setOffset} />

      {editing ? (
        <AdminWordForm
          word={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      ) : null}

      {deleting ? (
        <AdminDeleteConfirm
          label={`单词 ${deleting.name}`}
          deleteUrl={`/api/admin/words/${encodeURIComponent(deleting.id)}`}
          onClose={() => setDeleting(null)}
          onDeleted={() => {
            setDeleting(null);
            load();
          }}
        />
      ) : null}
    </section>
  );
}

function AdminWordForm({ word, onClose, onSaved }: { word: AdminWord | null; onClose: () => void; onSaved: () => void }) {
  const isNew = !word;
  const [name, setName] = useState(word?.name || "");
  const [definitions, setDefinitions] = useState<AdminWordDefinition[]>(
    word?.definitions.length ? word.definitions : [{ phonetic: "", partOfSpeech: "", meaning: "" }]
  );
  const [examples, setExamples] = useState<AdminWordExample[]>(
    word?.examples.length ? word.examples : [{ english: "", chinese: "" }]
  );
  const [tags, setTags] = useState<string[]>(word?.tags.filter((t) => t !== "all") || []);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const wordTags = useWordTags();

  function updateDefinition(index: number, patch: Partial<AdminWordDefinition>) {
    setDefinitions((prev) => prev.map((d, i) => (i === index ? { ...d, ...patch } : d)));
  }
  function updateExample(index: number, patch: Partial<AdminWordExample>) {
    setExamples((prev) => prev.map((e, i) => (i === index ? { ...e, ...patch } : e)));
  }
  function toggleTag(id: string) {
    setTags((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const body = JSON.stringify({ name, definitions, examples, tags });
      if (isNew) {
        await api("/api/admin/words", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body
        });
      } else {
        await api(`/api/admin/words/${encodeURIComponent(word.id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body
        });
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AdminModal title={isNew ? "新建单词" : `编辑 ${word.name}`} onClose={onClose}>
      <form className="admin-form" onSubmit={submit}>
        <label>
          单词
          <input value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
        </label>

        <div className="admin-subsection">
          <div className="admin-subsection-head">
            <span>中文释义</span>
            <button type="button" className="link-button" onClick={() => setDefinitions((p) => [...p, { phonetic: "", partOfSpeech: "", meaning: "" }])}>
              <Plus size={16} /> 添加释义
            </button>
          </div>
          {definitions.map((definition, index) => (
            <div key={index} className="admin-repeat-row">
              <select
                className="admin-pos"
                value={definition.partOfSpeech}
                onChange={(e) => updateDefinition(index, { partOfSpeech: e.target.value })}
              >
                <option value="">词性</option>
                {posOptions(definition.partOfSpeech).map((pos) => (
                  <option key={pos} value={pos}>
                    {pos}
                  </option>
                ))}
              </select>
              <input
                value={definition.meaning}
                onChange={(e) => updateDefinition(index, { meaning: e.target.value })}
                placeholder="中文意思"
              />
              {definitions.length > 1 ? (
                <button type="button" className="icon-button danger" onClick={() => setDefinitions((p) => p.filter((_, i) => i !== index))}>
                  <X size={16} />
                </button>
              ) : null}
            </div>
          ))}
        </div>

        <div className="admin-subsection">
          <div className="admin-subsection-head">
            <span>例句</span>
            <button type="button" className="link-button" onClick={() => setExamples((p) => [...p, { english: "", chinese: "" }])}>
              <Plus size={16} /> 添加例句
            </button>
          </div>
          {examples.map((example, index) => (
            <div key={index} className="admin-repeat-row column">
              <input
                value={example.english}
                onChange={(e) => updateExample(index, { english: e.target.value })}
                placeholder="英文例句"
              />
              <input
                value={example.chinese}
                onChange={(e) => updateExample(index, { chinese: e.target.value })}
                placeholder="中文翻译"
              />
              {examples.length > 1 ? (
                <button type="button" className="icon-button danger" onClick={() => setExamples((p) => p.filter((_, i) => i !== index))}>
                  <X size={16} />
                </button>
              ) : null}
            </div>
          ))}
        </div>

        <div className="admin-subsection">
          <div className="admin-subsection-head">
            <span>分类</span>
          </div>
          <div className="admin-tag-options">
            {wordTags.map((tag) => (
              <label key={tag.id} className={`admin-tag-option${tags.includes(tag.id) ? " checked" : ""}`}>
                <input type="checkbox" checked={tags.includes(tag.id)} onChange={() => toggleTag(tag.id)} />
                {tag.label}
              </label>
            ))}
          </div>
        </div>

        {error ? <div className="notice danger">{error}</div> : null}
        <div className="admin-form-actions">
          <button type="button" className="link-button" onClick={onClose}>
            取消
          </button>
          <button className="primary-button small" disabled={submitting}>
            {submitting ? <Loader2 className="spin" size={18} /> : <Check size={18} />}
            保存
          </button>
        </div>
      </form>
    </AdminModal>
  );
}

function AdminDeleteConfirm({
  label,
  deleteUrl,
  onClose,
  onDeleted
}: {
  label: string;
  deleteUrl: string;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function confirm() {
    setSubmitting(true);
    setError("");
    try {
      const result = await api(deleteUrl, { method: "DELETE" });
      if (result?.submissionCount > 0) {
        // history remains but will no longer show this item; surfaced via the count below before confirming
      }
      onDeleted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "删除失败");
      setSubmitting(false);
    }
  }

  return (
    <AdminModal title="确认删除" onClose={onClose}>
      <div className="admin-form">
        <p>确定要删除 {label} 吗？已有的历史练习记录会保留，但将不再显示该内容。</p>
        {error ? <div className="notice danger">{error}</div> : null}
        <div className="admin-form-actions">
          <button type="button" className="link-button" onClick={onClose}>
            取消
          </button>
          <button className="primary-button small danger" onClick={confirm} disabled={submitting}>
            {submitting ? <Loader2 className="spin" size={18} /> : <Trash2 size={18} />}
            删除
          </button>
        </div>
      </div>
    </AdminModal>
  );
}

function AdminModal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="admin-modal-backdrop" onClick={onClose}>
      <div className="admin-modal" onClick={(event) => event.stopPropagation()}>
        <div className="admin-modal-head">
          <h2>{title}</h2>
          <button className="icon-button" onClick={onClose} title="关闭">
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function AdminPager({ total, offset, onOffset }: { total: number; offset: number; onOffset: (value: number) => void }) {
  if (total === 0) return null;
  const pageCount = Math.ceil(total / ADMIN_PAGE_SIZE);
  const page = Math.floor(offset / ADMIN_PAGE_SIZE) + 1;
  const goToPage = (p: number) => onOffset((Math.min(Math.max(p, 1), pageCount) - 1) * ADMIN_PAGE_SIZE);
  const from = offset + 1;
  const to = Math.min(offset + ADMIN_PAGE_SIZE, total);

  return (
    <div className="admin-pager">
      <span className="admin-pager-info">
        第 {from}–{to} 条 / 共 {total} 条
      </span>
      {pageCount > 1 ? (
        <div className="admin-pager-controls">
          <button className="admin-page-step" title="首页" disabled={page === 1} onClick={() => goToPage(1)}>
            <ChevronsLeft size={16} />
          </button>
          <button className="admin-page-step" title="上一页" disabled={page === 1} onClick={() => goToPage(page - 1)}>
            <ChevronLeft size={16} />
          </button>
          {pageNumbers(page, pageCount).map((item, index) =>
            item === "…" ? (
              <span key={`gap-${index}`} className="admin-page-gap">
                …
              </span>
            ) : (
              <button
                key={item}
                className={`admin-page-num${item === page ? " active" : ""}`}
                onClick={() => goToPage(item)}
              >
                {item}
              </button>
            )
          )}
          <button className="admin-page-step" title="下一页" disabled={page === pageCount} onClick={() => goToPage(page + 1)}>
            <ChevronRight size={16} />
          </button>
          <button className="admin-page-step" title="末页" disabled={page === pageCount} onClick={() => goToPage(pageCount)}>
            <ChevronsRight size={16} />
          </button>
        </div>
      ) : null}
    </div>
  );
}

// 生成带省略号的页码窗口：始终含首末页，当前页前后各 1 页。
function pageNumbers(page: number, pageCount: number): Array<number | "…"> {
  const pages = new Set<number>([1, pageCount, page, page - 1, page + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= pageCount).sort((a, b) => a - b);
  const result: Array<number | "…"> = [];
  let prev = 0;
  for (const p of sorted) {
    if (p - prev > 1) result.push("…");
    result.push(p);
    prev = p;
  }
  return result;
}

class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function api(path: string, init?: RequestInit) {
  const response = await fetch(apiUrl(path), init);
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new ApiError(response.status, data.error || "请求失败");
  }
  return data;
}

function apiUrl(path: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  return `${base}${path}`;
}

async function playWordAudioById(wordId: string): Promise<void> {
  const audio = new Audio(apiUrl(`/api/word-audio/${encodeURIComponent(wordId)}`));
  await audio.play();
}

// 把音标用斜杠包裹，如 /bɜːn/；若已自带斜杠则原样保留。
function formatPhonetics(phonetics: string[]): string {
  return phonetics
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => (/^\/.*\/$/.test(p) ? p : `/${p.replace(/^\/|\/$/g, "")}/`))
    .join("  ");
}

function formatDate(value: string): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

createRoot(document.getElementById("root")!).render(<App />);
