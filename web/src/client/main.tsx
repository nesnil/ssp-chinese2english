import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowRight,
  BadgeCheck,
  BookOpen,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Coins,
  Flag,
  Flame,
  GraduationCap,
  History,
  Heart,
  ListChecks,
  Loader2,
  LogOut,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Settings,
  Sparkles,
  Star,
  Trash2,
  Trophy,
  Volume2,
  Wallet,
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

type ActivityPracticeStatus = "none" | "partial" | "complete";

type ActivityPracticeSummary = {
  status: ActivityPracticeStatus;
  label: string;
  score: number | null;
  count: number;
  time: string | null;
};

type ActivityCalendarEvent = {
  type: "sentence" | "word";
  practiceKind?: WordPracticeProfile;
  label: string;
  detail: string;
  score: number | null;
  time: string | null;
  occurredAt: string | null;
};

type ActivityCalendarDay = {
  date: string;
  completed: boolean;
  sentence: ActivityPracticeSummary;
  juniorWord: ActivityPracticeSummary;
  seniorWord: ActivityPracticeSummary;
  word: ActivityPracticeSummary;
  events: ActivityCalendarEvent[];
};

type ActivityCalendarData = {
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

type ActivityEventFilter = "sentence" | "juniorWord" | "seniorWord";

type WordProgress = {
  profile?: WordPracticeProfile;
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
  profile?: WordPracticeProfile;
  title: string;
  heroTitle?: string;
  subtitle?: string;
  includesExamples?: boolean;
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
  attemptCount: number;
  bestAverageScore: number | null;
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

type WordLevelData = {
  levelSize?: number;
  groups: WordLevelGroup[];
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

type WordExampleItem = { english: string; chinese: string };
type WordDetails = {
  id: string;
  name: string;
  phonetics: string[];
  definitions: Array<{ phonetic: string; partOfSpeech: string; meaning: string }>;
  example: WordExampleItem;
  examples: WordExampleItem[];
  tags: string[];
  hasAudio: boolean;
};

type WordPracticeProfile = "junior" | "senior";

type SeniorWordSummaryItem = {
  itemNo: number;
  wordId: string;
  name: string;
  definitions: Array<{ partOfSpeech: string; meaning: string }>;
  score: number | null;
  level: string | null;
  errorSummary: string | null;
};

type SeniorWordSessionSummary = {
  sessionId: number;
  wordCount: number;
  submittedCount: number;
  errorCount: number;
  averageScore: number | null;
  displayAverageScore: number | null;
  rewardAverageAbove: number;
  penaltyAverageBelow: number;
  wallet: WalletChange;
  items: SeniorWordSummaryItem[];
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

type WalletChange = {
  change: number;
  balance: number;
  reason: "perfect" | "fail" | null;
};

type WalletTx = {
  id: number;
  type: "reward" | "penalty" | "withdraw" | "adjust" | string;
  amountCents: number;
  source: string | null;
  refId: string | null;
  score: number | null;
  status: string | null;
  paidAt: string | null;
  note: string | null;
  createdAt: string;
};

type WalletSummary = {
  balanceCents: number;
  thresholdCents: number;
  canWithdraw: boolean;
  transactions: WalletTx[];
  withdrawals: WalletTx[];
};

const DEFAULT_WORD_SCOPE_TAG = "shanghai-zhongkao";
const WORD_PROFILE_LABELS: Record<WordPracticeProfile, { tab: string; fallbackTitle: string; fallbackHero: string }> = {
  junior: { tab: "中考词汇练习", fallbackTitle: "上海初中英语考纲词汇", fallbackHero: "听发音，默写单词和例句" },
  senior: { tab: "高考词汇练习", fallbackTitle: "高考词汇练习", fallbackHero: "听发音，默写单词和中文意思" }
};

// Injected at build time from the latest git tag (see vite.config.ts).
const APP_VERSION = typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "dev";

function App() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [catalog, setCatalog] = useState<SeasonCatalog[]>([]);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [wordProgress, setWordProgress] = useState<WordProgress | null>(null);
  const [seniorWordProgress, setSeniorWordProgress] = useState<WordProgress | null>(null);
  const [activeDay, setActiveDay] = useState<{ season: number; day: number } | null>(null);
  const [reviewMode, setReviewMode] = useState<"center" | "practice" | null>(null);
  const [walletOpen, setWalletOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [wallet, setWallet] = useState<WalletSummary | null>(null);
  const [homeMode, setHomeMode] = useState<"sentences" | "juniorWords" | "seniorWords">("sentences");
  const [role, setRole] = useState<"user" | "admin">("user");
  const [adminMode, setAdminMode] = useState(() => typeof location !== "undefined" && location.hash === "#admin");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const [catalogResponse, progressResponse, wordProgressResponse, seniorWordProgressResponse, meResponse, walletResponse] = await Promise.all([
        api("/api/catalog"),
        api("/api/progress"),
        api("/api/word/progress?profile=junior"),
        api("/api/word/progress?profile=senior"),
        api("/api/me"),
        api("/api/wallet")
      ]);
      setCatalog(catalogResponse.seasons);
      setProgress(progressResponse);
      setWordProgress(wordProgressResponse);
      setSeniorWordProgress(seniorWordProgressResponse);
      setWallet(walletResponse);
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

  if (walletOpen) {
    return (
      <WalletScreen
        onBack={() => {
          setWalletOpen(false);
          refresh();
        }}
      />
    );
  }

  if (activityOpen) {
    return (
      <ActivityCalendarScreen
        onBack={() => {
          setActivityOpen(false);
          refresh();
        }}
      />
    );
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
      walletBalanceCents={wallet ? wallet.balanceCents : null}
      onOpenWallet={() => setWalletOpen(true)}
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
      <div className="home-nav-row">
        <button className="icon-button activity-entry-button" onClick={() => setActivityOpen(true)} title="每日完成情况" aria-label="每日完成情况">
          <CalendarDays size={21} />
        </button>
        <HomeTabs
          active={homeMode}
          onChange={setHomeMode}
          progress={progress}
          wordProgress={wordProgress}
          seniorWordProgress={seniorWordProgress}
        />
      </div>
      {homeMode === "sentences" ? (
        <Dashboard
          progress={progress}
          seasons={catalog}
          onStartDay={setActiveDay}
          onStartReview={() => setReviewMode("center")}
        />
      ) : (
        <WordPracticeScreen
          key={homeMode}
          profile={homeMode === "seniorWords" ? "senior" : "junior"}
          initialMode="new"
          embedded
          onBack={() => setHomeMode("sentences")}
          onWalletBalance={(balanceCents) =>
            setWallet((prev) => (prev ? { ...prev, balanceCents, canWithdraw: balanceCents >= prev.thresholdCents } : prev))
          }
        />
      )}
    </Shell>
  );
}

function Shell({
  children,
  onLogout,
  showAdmin,
  onOpenAdmin,
  walletBalanceCents,
  onOpenWallet
}: {
  children: React.ReactNode;
  onLogout: () => void;
  showAdmin?: boolean;
  onOpenAdmin?: () => void;
  walletBalanceCents?: number | null;
  onOpenWallet?: () => void;
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
          {onOpenWallet ? (
            <button
              className={`wallet-chip ${(walletBalanceCents ?? 0) < 0 ? "negative" : ""}`}
              onClick={onOpenWallet}
              title="我的钱包"
            >
              <Wallet size={18} />
              <strong>{formatYuan(walletBalanceCents ?? 0)}</strong>
            </button>
          ) : null}
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
  wordProgress,
  seniorWordProgress
}: {
  active: "sentences" | "juniorWords" | "seniorWords";
  onChange: (value: "sentences" | "juniorWords" | "seniorWords") => void;
  progress: Progress | null;
  wordProgress: WordProgress | null;
  seniorWordProgress: WordProgress | null;
}) {
  return (
    <nav className="home-tabs" aria-label="练习类型">
      <button className={active === "sentences" ? "active" : ""} onClick={() => onChange("sentences")}>
        <Flag size={19} />
        中译英
        {progress?.reviewCount ? <span>{progress.reviewCount}</span> : null}
      </button>
      <button className={active === "juniorWords" ? "active" : ""} onClick={() => onChange("juniorWords")}>
        <BookOpen size={19} />
        中考词汇练习
        {wordProgress?.reviewWords ? <span>{wordProgress.reviewWords}</span> : null}
      </button>
      <button className={active === "seniorWords" ? "active" : ""} onClick={() => onChange("seniorWords")}>
        <GraduationCap size={19} />
        高考词汇练习
        {seniorWordProgress?.reviewWords ? <span>{seniorWordProgress.reviewWords}</span> : null}
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
  const regularSeasonCount = seasons.filter((season) => String(season.season) !== "5").length;
  const hasSupplementSeason = seasons.some((season) => String(season.season) === "5");
  const seasonSummary = hasSupplementSeason ? `${regularSeasonCount} 季 + 补充题` : `${seasons.length} 季`;
  const totalDays = seasons.reduce((sum, season) => sum + season.dayCount, 0);
  const totalQuestions = seasons.reduce((sum, season) => sum + season.questionCount, 0);

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
          <span>{seasonSummary} · {totalDays} 天 · {totalQuestions} 题</span>
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
        <h3>{questionSeasonMapTitle(season.season)}</h3>
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
              title={`${questionSeasonLabel(season.season)} Day ${day.day}`}
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
  const [walletChange, setWalletChange] = useState<WalletChange | null>(null);
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
      setWalletChange(response.wallet || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "提交失败");
    } finally {
      setSubmitting(false);
    }
  }

  function next() {
    setAnswer("");
    setGrade(null);
    setWalletChange(null);
    setCurrent((value) => value + 1);
  }

  return (
    <main className="practice-shell">
      <header className="practice-header">
        <button className="soft-button" onClick={onBack}>
          返回地图
        </button>
        <div>
          <strong>{questionSeasonLabel(season)} Day {day}</strong>
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
            <Feedback grade={grade} wallet={walletChange} onNext={next} isLast={current === questions.length - 1} />
          )}
          {submitting ? <GradingOverlay /> : null}
        </section>
      ) : null}
    </main>
  );
}

const WALLET_TX_LABELS: Record<string, string> = {
  reward: "练习奖励",
  penalty: "答题扣除",
  withdraw: "提现",
  adjust: "家长调整"
};

function walletTxLabel(type: string): string {
  return WALLET_TX_LABELS[type] || type;
}

function walletTxIcon(type: string): React.ReactNode {
  if (type === "reward") return <Coins size={18} />;
  if (type === "penalty") return <X size={18} />;
  if (type === "withdraw") return <Wallet size={18} />;
  return <Settings size={18} />;
}

// 流水的小字说明:句子 ref 解析成"第几季第几天第几题",单词 ref 标出阶段,调整显示备注。
function walletTxCaption(tx: WalletTx): string {
  if (tx.type === "adjust") return tx.note || "";
  if (tx.type === "withdraw") return tx.status === "paid" ? "已发放" : "待发放";
  if (!tx.refId) return "";
  const match = tx.refId.match(/^S(\d+)-D(\d+)-Q(\d+)$/);
  if (match) return `${questionSeasonLabel(match[1])} Day ${match[2]} 第 ${match[3]} 题`;
  if (tx.source === "senior-word-session") return "高考词汇练习 · 整组平均分";
  if (tx.source === "word") return tx.refId.endsWith(":example") ? "单词练习 · 例句" : "单词练习 · 默写";
  return "";
}

function ActivityCalendarScreen({ onBack }: { onBack: () => void }) {
  const [year, setYear] = useState(currentShanghaiYear);
  const [data, setData] = useState<ActivityCalendarData | null>(null);
  const [selectedDate, setSelectedDate] = useState("");
  const [activityEventFilter, setActivityEventFilter] = useState<ActivityEventFilter>("sentence");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const todayButtonRef = useRef<HTMLButtonElement | null>(null);
  const pendingTodayScrollRef = useRef(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    api(`/api/activity-calendar?year=${year}`)
      .then((response: ActivityCalendarData) => {
        if (!alive) return;
        setData(response);
        setSelectedDate((current) => selectActivityDate(response, current));
      })
      .catch((err) => {
        if (alive) setError(err instanceof Error ? err.message : "每日完成情况加载失败");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [year]);

  const months = useMemo(() => (data ? groupActivityMonths(data.days) : []), [data]);
  const selectedDay = data?.days.find((day) => day.date === selectedDate) || null;
  const filteredEvents = selectedDay ? activityEventsForFilter(selectedDay.events, activityEventFilter) : [];
  const averageScore = data?.summary.averageScore ?? null;
  const todayYear = data ? Number(data.today.slice(0, 4)) : currentShanghaiYear();

  useEffect(() => {
    if (selectedDay) setActivityEventFilter(firstActivityEventFilter(selectedDay));
  }, [selectedDay?.date]);

  useEffect(() => {
    if (!data || !pendingTodayScrollRef.current || year !== todayYear) return;
    pendingTodayScrollRef.current = false;
    setSelectedDate(data.today);
    requestAnimationFrame(() => {
      todayButtonRef.current?.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
    });
  }, [data, todayYear, year]);

  function jumpToToday() {
    if (!data) return;
    pendingTodayScrollRef.current = true;
    if (year !== todayYear) {
      setYear(todayYear);
      return;
    }
    setSelectedDate(data.today);
    requestAnimationFrame(() => {
      todayButtonRef.current?.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
      pendingTodayScrollRef.current = false;
    });
  }

  return (
    <main className="practice-shell activity-shell">
      <header className="practice-header activity-header">
        <button className="soft-button" onClick={onBack}>
          返回地图
        </button>
        <div>
          <strong>每日完成情况</strong>
        </div>
        <div className="activity-year-switcher" aria-label="选择年份">
          <button className="icon-button" onClick={() => setYear((value) => value - 1)} title="上一年">
            <ChevronLeft size={20} />
          </button>
          <b>{year}</b>
          <button className="icon-button" onClick={() => setYear((value) => value + 1)} title="下一年">
            <ChevronRight size={20} />
          </button>
        </div>
      </header>

      {loading ? <LoadingScreen compact /> : null}
      {error ? <div className="notice danger">{error}</div> : null}

      {!loading && data ? (
        <>
          <section className="activity-top-panel">
            <div className="activity-detail-panel">
              {selectedDay ? (
                <>
                  <span className="activity-detail-date">{formatActivityDate(selectedDay.date)}</span>
                  <h1>{selectedDay.completed ? "这天练过啦" : "这天还没有练习"}</h1>
                  <div className="activity-detail-summary-grid">
                    <ActivityDetailSummaryCard
                      kind="sentence"
                      title="中译英"
                      summary={selectedDay.sentence}
                      selected={activityEventFilter === "sentence"}
                      onSelect={() => setActivityEventFilter("sentence")}
                    />
                    <ActivityDetailSummaryCard
                      kind="juniorWord"
                      title="中考词汇"
                      summary={selectedDay.juniorWord}
                      selected={activityEventFilter === "juniorWord"}
                      onSelect={() => setActivityEventFilter("juniorWord")}
                    />
                    <ActivityDetailSummaryCard
                      kind="seniorWord"
                      title="高考词汇"
                      summary={selectedDay.seniorWord}
                      selected={activityEventFilter === "seniorWord"}
                      onSelect={() => setActivityEventFilter("seniorWord")}
                    />
                  </div>
                  <div className="activity-event-column">
                    <div className="activity-event-head">
                      <strong>{activityFilterTitle(activityEventFilter)}记录</strong>
                      <span>{filteredEvents.length} 条</span>
                    </div>
                    <div className="activity-event-list">
                      {filteredEvents.length ? (
                        filteredEvents.map((event, index) => {
                          const EventIcon = event.type === "sentence" ? Flag : event.practiceKind === "senior" ? GraduationCap : BookOpen;
                          return (
                            <article
                              key={`${event.type}-${event.practiceKind || "sentence"}-${event.occurredAt || index}`}
                              className={activityEventClass(event)}
                            >
                              <span>
                                <EventIcon size={18} />
                              </span>
                              <div>
                                <strong>{event.label}</strong>
                                <small>
                                  {event.time ? `${event.time} · ` : ""}
                                  {event.detail}
                                </small>
                              </div>
                            </article>
                          );
                        })
                      ) : (
                        <p className="wallet-empty">这天没有{activityFilterTitle(activityEventFilter)}记录。</p>
                      )}
                    </div>
                  </div>
                </>
              ) : null}
            </div>

            <div className="activity-summary-strip" aria-label="年度完成总览">
              <span>
                <Flame size={17} />
                当前连续 <b>{data.summary.currentStreak} 天</b>
              </span>
              <span>
                <Trophy size={17} />
                最长 <b>{data.summary.longestStreak} 天</b>
              </span>
              <span>
                <CalendarDays size={17} />
                完成 <b>{data.summary.completedDays}/{data.days.length}</b>
              </span>
              <span>
                <Star size={17} />
                均分 <b>{averageScore === null ? "--" : averageScore}</b>
              </span>
            </div>
          </section>

          <section className="activity-layout">
            <div className="activity-calendar-panel">
              <div className="section-title">
                <div className="activity-calendar-title">
                  <h2>{year} 年日历</h2>
                  <button className="activity-today-button" onClick={jumpToToday}>
                    <CalendarDays size={17} />
                    今天
                  </button>
                </div>
                <span className="activity-calendar-legend">蓝色为三项都有记录，黄色为有练习，灰色为未练</span>
              </div>
              <div className="activity-months">
                {months.map((month) => (
                  <article key={month.key} className="activity-month">
                    <h3>{month.label}</h3>
                    <div className="activity-day-grid">
                      {month.days.map((day) => (
                        <button
                          key={day.date}
                          className={`activity-day level-${activityDayLevel(day)} ${
                            day.date === selectedDate ? "selected" : ""
                          } ${day.date === data.today ? "today" : ""}`}
                          ref={day.date === data.today ? todayButtonRef : undefined}
                          onClick={() => setSelectedDate(day.date)}
                          title={activityDayTitle(day)}
                        >
                          <b>{Number(day.date.slice(8, 10))}</b>
                          <div className="activity-day-rows">
                            <ActivityCellRow kind="sentence" label="翻译" summary={day.sentence} />
                            <ActivityCellRow kind="juniorWord" label="中词" summary={day.juniorWord} />
                            <ActivityCellRow kind="seniorWord" label="高词" summary={day.seniorWord} />
                          </div>
                        </button>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </section>
        </>
      ) : null}
    </main>
  );
}

function ActivityCellRow({
  kind,
  label,
  summary
}: {
  kind: "sentence" | "juniorWord" | "seniorWord";
  label: string;
  summary: ActivityPracticeSummary;
}) {
  const done = summary.status !== "none";
  const perfect = summary.score === 100;
  const Icon = kind === "sentence" ? Flag : kind === "seniorWord" ? GraduationCap : BookOpen;
  const scoreLabel = done ? (summary.score === null ? "已练" : String(summary.score)) : "--";
  return (
    <span
      className={`activity-cell-row ${kind} ${done ? "done" : "none"} ${perfect ? "perfect" : ""}`}
      title={`${label}：${summary.label}`}
      aria-label={`${label}：${summary.label}`}
    >
      <Icon size={12} className="activity-cell-icon" />
      <span className="activity-cell-score">{scoreLabel}</span>
      {perfect ? <Sparkles size={12} className="activity-cell-star" /> : null}
    </span>
  );
}

function ActivityDetailSummaryCard({
  kind,
  title,
  summary,
  selected,
  onSelect
}: {
  kind: "sentence" | "juniorWord" | "seniorWord";
  title: string;
  summary: ActivityPracticeSummary;
  selected: boolean;
  onSelect: () => void;
}) {
  const Icon = kind === "sentence" ? Flag : kind === "seniorWord" ? GraduationCap : BookOpen;
  const score = summary.status === "none" ? "--" : summary.score === null ? "已练" : summary.score;
  const statusLabel = summary.status === "complete" ? `完成 ${summary.count || 1} 次` : summary.status === "partial" ? "已练" : "未练";
  return (
    <button
      type="button"
      className={`activity-detail-summary-card ${kind} ${summary.status} ${selected ? "selected" : ""}`}
      onClick={onSelect}
      aria-pressed={selected}
    >
      <span>
        <Icon size={18} />
      </span>
      <div>
        <strong>{title}</strong>
        <small>{statusLabel}</small>
      </div>
      <b>
        <small>完成均分</small>
        {score}
      </b>
    </button>
  );
}

function WalletScreen({ onBack }: { onBack: () => void }) {
  const [data, setData] = useState<WalletSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [withdrawing, setWithdrawing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function load() {
    setError("");
    try {
      setData(await api("/api/wallet"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "钱包加载失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function withdraw() {
    if (!data?.canWithdraw || withdrawing) return;
    setWithdrawing(true);
    setError("");
    setNotice("");
    try {
      await api("/api/wallet/withdraw", { method: "POST" });
      setNotice("提现申请已提交，等爸爸妈妈发放～");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "提现失败");
    } finally {
      setWithdrawing(false);
    }
  }

  const balance = data?.balanceCents ?? 0;
  const threshold = data?.thresholdCents || 1000;
  const percent = Math.max(0, Math.min(100, (balance / threshold) * 100));

  return (
    <main className="practice-shell">
      <header className="practice-header">
        <button className="soft-button" onClick={onBack}>
          返回地图
        </button>
        <div>
          <strong>我的钱包</strong>
          <span>攒够 {formatYuan(threshold)} 可以提现</span>
        </div>
      </header>

      {loading ? <LoadingScreen compact /> : null}
      {error ? <div className="notice danger">{error}</div> : null}
      {notice ? <div className="notice">{notice}</div> : null}

      {!loading && data ? (
        <>
          <section className={`wallet-hero ${balance < 0 ? "negative" : ""}`}>
            <div className="wallet-hero-card">
              <WalletCard balanceCents={balance} />
            </div>
            <div className="wallet-progress">
              <p className="wallet-hero-note">
                {balance < 0 ? "先把欠的赚回来，加油！" : "考满分有奖励，攒够就能找爸爸妈妈提现。"}
              </p>
              <div className="wallet-progress-track">
                <div className="wallet-progress-fill" style={{ width: `${percent}%` }} />
              </div>
              <small>
                已攒 {formatYuan(Math.max(0, balance))} / 提现门槛 {formatYuan(threshold)}
              </small>
              <button className="primary-button wide" onClick={withdraw} disabled={!data.canWithdraw || withdrawing}>
                {withdrawing ? <Loader2 className="spin" size={20} /> : <Coins size={20} />}
                {data.canWithdraw ? `提现 ${formatYuan(balance)}` : `还差 ${formatYuan(Math.max(0, threshold - balance))} 可提现`}
              </button>
            </div>
          </section>

          {data.withdrawals.length ? (
            <section className="wallet-panel">
              <div className="section-title">
                <h2>提现记录</h2>
                <span>给爸爸妈妈看,发完钱打勾</span>
              </div>
              <div className="wallet-tx-list">
                {data.withdrawals.map((tx) => (
                  <article key={tx.id} className="wallet-tx">
                    <span className="wallet-tx-icon withdraw">{walletTxIcon("withdraw")}</span>
                    <div className="wallet-tx-main">
                      <strong>提现 {formatYuan(-tx.amountCents)}</strong>
                      <small>{formatDate(tx.createdAt)}</small>
                    </div>
                    <span className={`wallet-status ${tx.status === "paid" ? "paid" : "pending"}`}>
                      {tx.status === "paid" ? (
                        <>
                          <BadgeCheck size={14} />
                          已发放
                        </>
                      ) : (
                        "待发放"
                      )}
                    </span>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          <section className="wallet-panel">
            <div className="section-title">
              <h2>钱包流水</h2>
              <span>最近 {data.transactions.length} 笔</span>
            </div>
            <div className="wallet-tx-list">
              {data.transactions.length ? (
                data.transactions.map((tx) => (
                  <article key={tx.id} className="wallet-tx">
                    <span className={`wallet-tx-icon ${tx.type}`}>{walletTxIcon(tx.type)}</span>
                    <div className="wallet-tx-main">
                      <strong>{walletTxLabel(tx.type)}</strong>
                      <small>
                        {walletTxCaption(tx)}
                        {walletTxCaption(tx) ? " · " : ""}
                        {formatDate(tx.createdAt)}
                      </small>
                    </div>
                    <b className={`wallet-amount ${tx.amountCents >= 0 ? "gain" : "loss"}`}>{formatYuanDelta(tx.amountCents)}</b>
                  </article>
                ))
              ) : (
                <p className="wallet-empty">还没有流水，考个满分赚第一笔吧！</p>
              )}
            </div>
          </section>
        </>
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
                          <span>{questionSeasonLabel(question.season)} Day {question.day} · 第 {question.questionNo} 题</span>
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
                        <span>{questionSeasonLabel(record.season)} Day {record.day} · 第 {record.questionNo} 题</span>
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
  const [walletChange, setWalletChange] = useState<WalletChange | null>(null);
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
      setWalletChange(response.wallet || null);
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
    setWalletChange(null);
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
            <span>{questionSeasonLabel(question.season)} Day {question.day} · 第 {question.questionNo} 题</span>
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
              wallet={walletChange}
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
  profile,
  initialMode,
  onBack,
  embedded = false,
  onWalletBalance
}: {
  profile: WordPracticeProfile;
  initialMode: "new" | "review";
  onBack: () => void;
  embedded?: boolean;
  // 嵌入首页时顶栏钱包 chip 可见,提交后把最新余额回传给 App 实时刷新。
  onWalletBalance?: (balanceCents: number) => void;
}) {
  const [catalog, setCatalog] = useState<WordCatalog | null>(null);
  const [progress, setProgress] = useState<WordProgress | null>(null);
  const [levelGroups, setLevelGroups] = useState<WordLevelGroup[]>([]);
  const [levelSize, setLevelSize] = useState(5);
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
  const [wordWallet, setWordWallet] = useState<WalletChange | null>(null);
  const [exampleAnswers, setExampleAnswers] = useState<string[]>([]);
  const [exampleGrade, setExampleGrade] = useState<Grade | null>(null);
  const [exampleWallet, setExampleWallet] = useState<WalletChange | null>(null);
  const [seniorSummary, setSeniorSummary] = useState<SeniorWordSessionSummary | null>(null);
  const [details, setDetails] = useState<WordDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    const query = wordProfileQuery(profile);
    Promise.all([
      api(`/api/word/catalog?${query}`),
      api(`/api/word/progress?${query}`),
      api(`/api/word/settings?${query}`),
      api(`/api/word/levels?${query}`)
    ])
      .then(async ([catalogData, progressData, settingsData, levelData]) => {
        if (!mounted) return;
        setCatalog(catalogData);
        setProgress(progressData);
        setLevelGroups(levelData.groups || []);
        setLevelSize(levelData.levelSize || settingsData.batchSize || (profile === "senior" ? 10 : 5));
        setBatchSize(settingsData.batchSize || 5);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "词汇练习加载失败"))
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, [profile]);

  const word = words[current];
  const threshold = progress?.threshold || 80;
  const wordPassed = Boolean(wordGrade && wordGrade.score >= threshold);
  const practiceStarted = Boolean(sessionId);
  const reviewing = mode === "review";
  const includesExamples = catalog?.includesExamples !== false;
  const profileText = WORD_PROFILE_LABELS[profile];
  const catalogTitle = catalog?.title || profileText.fallbackTitle;
  const heroTitle = catalog?.heroTitle || profileText.fallbackHero;
  const wordMasteredPercent = ((progress?.masteredWords || 0) / (progress?.totalWords || 1650)) * 100;
  const wordMasteredPercentLabel =
    wordMasteredPercent > 0 && wordMasteredPercent < 1 ? `${wordMasteredPercent.toFixed(1)}%` : `${Math.round(wordMasteredPercent)}%`;
  const complete = !loading && practiceStarted && words.length > 0 && current >= words.length;
  const empty = !loading && practiceStarted && words.length === 0;

  async function startSession(nextMode = mode, nextTag = tag, nextLevelId: string | null = null) {
    setError("");
    setCurrent(0);
    setSeniorSummary(null);
    resetWordState();
    try {
      const data = await api("/api/word-sessions/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile, mode: nextMode, tag: nextTag, levelId: nextLevelId })
      });
      setSessionId(data.sessionId);
      const loadedWords = data.words || [];
      const resume = data.resume as WordSessionResume | null;
      setWords(loadedWords);
      setMode(nextMode);
      setTag(data.scopeTag || nextTag);
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
          if (profile === "senior") {
            await loadSeniorSummary(data.sessionId);
          }
        }
      }
    } catch (err) {
      setSessionId(null);
      setWords([]);
      setSeniorSummary(null);
      setError(err instanceof Error ? err.message : "词汇练习开始失败");
    }
  }

  async function refreshWordProgress() {
    try {
      const query = wordProfileQuery(profile);
      const [progressData, levelData] = (await Promise.all([
        api(`/api/word/progress?${query}`),
        api(`/api/word/levels?${query}`)
      ])) as [WordProgress, WordLevelData];
      setProgress(progressData);
      setLevelGroups(levelData.groups || []);
      if (levelData.levelSize) setLevelSize(levelData.levelSize);
    } catch {
      // Keep the current practice flow uninterrupted if the summary refresh fails.
    }
  }

  function resetWordState() {
    setWordAnswer("");
    setMeaningAnswers({});
    setWordGrade(null);
    setWordWallet(null);
    setExampleAnswers([]);
    setExampleGrade(null);
    setExampleWallet(null);
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
          profile,
          wordId: word.id,
          phase: "word",
          wordAnswer,
          meaningAnswers
        })
      });
      if (profile === "senior" && response.sessionComplete) {
        setDetails(response.details);
        await refreshWordProgress();
        await loadSeniorSummary(sessionId);
        setCurrent(words.length);
        resetWordState();
        return;
      }
      setWordGrade(response.grade);
      setWordWallet(response.wallet || null);
      if (response.wallet && onWalletBalance) onWalletBalance(response.wallet.balance);
      setDetails(response.details);
      await refreshWordProgress();
    } catch (err) {
      setError(err instanceof Error ? err.message : "提交失败");
    } finally {
      setSubmitting(false);
    }
  }

  async function submitExample() {
    const exampleCount = details?.examples?.length || 0;
    if (!word || !exampleAnswers.some((entry) => entry.trim())) return;
    setSubmitting(true);
    setError("");
    try {
      const response = await api("/api/word-submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          profile,
          wordId: word.id,
          phase: "example",
          exampleAnswers: Array.from({ length: exampleCount }, (_, index) => exampleAnswers[index] || "")
        })
      });
      setExampleGrade(response.grade);
      setExampleWallet(response.wallet || null);
      if (response.wallet && onWalletBalance) onWalletBalance(response.wallet.balance);
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

  async function loadSeniorSummary(nextSessionId = sessionId) {
    if (!nextSessionId) return;
    const summary = (await api(`/api/word-sessions/${nextSessionId}/summary?${wordProfileQuery("senior")}`, {
      method: "POST"
    })) as SeniorWordSessionSummary;
    setSeniorSummary(summary);
    if (summary.wallet && onWalletBalance) onWalletBalance(summary.wallet.balance);
  }

  async function returnToWordMap() {
    setSessionId(null);
    setWords([]);
    setCurrent(0);
    setActiveLevelId(null);
    setSeniorSummary(null);
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
            <strong>{catalogTitle}</strong>
            <span>{mode === "review" ? "词汇复习" : `每次 ${batchSize} 词`}</span>
          </div>
        </header>
      ) : (
        <header className="word-home-header hero-band">
          <div>
            <span className="eyebrow">
              <BookOpen size={16} />
              {catalogTitle}
            </span>
            <h1>{heroTitle}</h1>
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
          levelSize={levelSize}
          activeLevelId={activeLevelId}
          onSelect={(levelId) => startSession("new", tag, levelId)}
        />
      ) : null}

      {!loading && !practiceStarted && !levelGroups.length ? (
        <section className="finish-card">
          <Trophy size={56} />
          <h1>{profileText.tab}闯关表加载失败</h1>
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
        profile === "senior" && seniorSummary ? (
          <SeniorWordSummaryCard summary={seniorSummary} onDone={returnToWordMap} />
        ) : (
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
        )
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
              wallet={wordWallet}
              onNext={nextWord}
              isLast={current === words.length - 1}
              nextLabel={includesExamples && wordPassed ? "继续例句" : current === words.length - 1 ? "完成这一组" : "下一词"}
              hideNext={includesExamples && wordPassed}
            />
          )}

          {includesExamples && wordPassed && details ? (
            <section className="example-panel">
              <div className="question-topline">
                <span>例句默写{details.examples.length > 1 ? ` · 共 ${details.examples.length} 句` : ""}</span>
                <b>{threshold} 分过关</b>
              </div>
              {details.examples.map((example, index) => (
                <div key={index} className="example-item">
                  <h1>
                    {details.examples.length > 1 ? <span className="example-no">{index + 1}.</span> : null}
                    {example.chinese}
                  </h1>
                  <textarea
                    value={exampleAnswers[index] || ""}
                    onChange={(event) =>
                      setExampleAnswers((prev) => {
                        const next = [...prev];
                        next[index] = event.target.value;
                        return next;
                      })
                    }
                    placeholder="默写英文例句..."
                    disabled={Boolean(exampleGrade)}
                  />
                </div>
              ))}
              {!exampleGrade ? (
                <button
                  className="primary-button submit"
                  onClick={submitExample}
                  disabled={submitting || !exampleAnswers.some((entry) => entry.trim())}
                >
                  {submitting ? <Loader2 className="spin" size={20} /> : <Sparkles size={20} />}
                  提交例句批改
                </button>
              ) : (
                <Feedback
                  grade={exampleGrade}
                  wallet={exampleWallet}
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

function SeniorWordSummaryCard({ summary, onDone }: { summary: SeniorWordSessionSummary; onDone: () => void }) {
  const average = summary.displayAverageScore ?? Math.round(summary.averageScore || 0);
  const rewardText =
    summary.errorCount > 0
      ? "有单词批改失败，本组不奖不扣。"
      : summary.wallet.reason === "perfect" && summary.wallet.change > 0
        ? `平均分达到奖励线，奖励 ${formatYuan(summary.wallet.change)}。`
        : summary.wallet.reason === "fail" && summary.wallet.change < 0
          ? `平均分低于扣钱线，扣除 ${formatYuan(-summary.wallet.change)}。`
          : `平均分在 ${summary.penaltyAverageBelow} 到 ${summary.rewardAverageAbove} 之间，本组不奖不扣。`;
  const summaryClass =
    summary.wallet.change > 0 ? "gain" : summary.wallet.change < 0 ? "loss" : summary.errorCount > 0 ? "error" : "neutral";

  return (
    <section className="senior-summary-card">
      <div className={`senior-summary-hero ${summaryClass}`}>
        <div className="score-bubble">
          <strong>{average}</strong>
          <span>平均分</span>
        </div>
        <div>
          <span className="eyebrow">
            <Trophy size={16} />
            高考词汇练习
          </span>
          <h1>本组练习总结</h1>
          <p>
            已完成 {summary.submittedCount} / {summary.wordCount} 个词，奖励线 {summary.rewardAverageAbove} 分，扣钱线 {summary.penaltyAverageBelow} 分。
          </p>
          <p className={`money-note ${summary.wallet.change > 0 ? "gain" : summary.wallet.change < 0 ? "loss" : ""}`}>{rewardText}</p>
        </div>
      </div>

      <div className="senior-summary-list">
        {summary.items.map((item) => (
          <article key={item.wordId} className="senior-summary-row">
            <span className="senior-summary-no">{item.itemNo}</span>
            <div className="senior-summary-word">
              <strong>{item.name}</strong>
              <small>{formatDefinitionSummary(item.definitions)}</small>
              {item.errorSummary ? <em>批改失败：{item.errorSummary}</em> : null}
            </div>
            <b className={summaryScoreClass(item.score)}>{item.score === null ? "--" : item.score}</b>
          </article>
        ))}
      </div>

      <div className="admin-form-actions senior-summary-actions">
        <button className="primary-button" onClick={onDone}>
          <Flag size={20} />
          完成本组练习
        </button>
      </div>
    </section>
  );
}

function WordLevelMap({
  groups,
  levelSize,
  activeLevelId,
  onSelect
}: {
  groups: WordLevelGroup[];
  levelSize: number;
  activeLevelId: string | null;
  onSelect: (levelId: string) => void;
}) {
  return (
    <section className="map-section word-map-section">
      <div className="section-title">
        <h2>词汇闯关表</h2>
        <span>A-Z 分组 · {levelSize} 词一关</span>
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
                  {level.bestAverageScore !== null ? <em>{level.bestAverageScore}</em> : null}
                  <span className="word-level-no">{level.status === "done" ? <Check size={20} /> : level.levelNo}</span>
                  <small>
                    {level.attemptCount > 0 ? `${level.attemptCount}次` : `${level.masteredCount}/${level.wordCount}`}
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
        <div className="grading-orbit" aria-hidden="true">
          <div className="grading-ring" />
          <div className="grading-core">
            <Sparkles size={28} />
          </div>
          <div className="grading-satellites">
            <span />
            <span />
            <span />
          </div>
        </div>
        <strong>AI 批改中</strong>
        <p>正在认真批改你的答案…</p>
        <div className="grading-dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
      </div>
    </div>
  );
}

// 参考/可改成：多句（用 " / " 分隔）时逐句分行编号，单句保持原样一行。
function AnswerLines({ label, text }: { label: string; text: string }) {
  const parts = text
    .split(" / ")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length <= 1) {
    return (
      <p>
        <b>{label}：</b>
        {text}
      </p>
    );
  }
  return (
    <div className="answer-lines">
      <b>{label}：</b>
      {parts.map((part, index) => (
        <span key={index} className="answer-line">
          <i>{index + 1}.</i>
          {part}
        </span>
      ))}
    </div>
  );
}

function Feedback({
  grade,
  onNext,
  isLast,
  nextLabel,
  hideNext = false,
  wallet = null
}: {
  grade: Grade;
  onNext: () => void;
  isLast: boolean;
  nextLabel?: string;
  hideNext?: boolean;
  wallet?: WalletChange | null;
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
        {wallet && wallet.reason === "perfect" && wallet.change > 0 ? (
          <p className="money-note gain coin-pop">
            <Coins size={18} />
            达标奖励 +{formatYuan(wallet.change)}，钱包共 {formatYuan(wallet.balance)}
          </p>
        ) : null}
        {wallet && wallet.reason === "fail" && wallet.change < 0 ? (
          <p className="money-note loss">小钱包 {formatYuan(wallet.change)}，下次赚回来！</p>
        ) : null}
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
        <AnswerLines label="参考" text={grade.referenceAnswer} />
        {!isPerfect ? <AnswerLines label="可改成" text={grade.improvedAnswer} /> : null}
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

const ADMIN_QUESTION_SEASON_OPTIONS = [
  { value: "1", label: "Season 1" },
  { value: "2", label: "Season 2" },
  { value: "3", label: "Season 3" },
  { value: "4", label: "Season 4" },
  { value: "5", label: "补充题" }
];
const ADMIN_QUESTION_DAY_OPTIONS = Array.from({ length: 10 }, (_, index) => String(index + 1));
const ADMIN_QUESTION_NO_OPTIONS = Array.from({ length: 10 }, (_, index) => String(index + 1));

function questionSeasonLabel(season: number | string): string {
  const value = String(season);
  return ADMIN_QUESTION_SEASON_OPTIONS.find((option) => option.value === value)?.label || `Season ${value}`;
}

function questionSeasonMapTitle(season: number | string): string {
  const value = String(season);
  return value === "5" ? "补充题" : `第 ${value} 季`;
}

function AdminRangeSetting({
  title,
  description,
  min,
  max,
  low,
  high,
  lowLabel,
  highLabel,
  unit,
  mode = "range",
  onLowChange,
  onHighChange
}: {
  title: string;
  description: string;
  min: number;
  max: number;
  low: number;
  high: number;
  lowLabel: string;
  highLabel: string;
  unit: string;
  mode?: "range" | "score";
  onLowChange: (value: number) => void;
  onHighChange: (value: number) => void;
}) {
  const safeLow = clampNumber(low, min, max);
  const safeHigh = clampNumber(high, min, max);
  const lowValue = Math.min(safeLow, safeHigh);
  const highValue = Math.max(safeLow, safeHigh);
  const lowPercent = ((lowValue - min) / (max - min)) * 100;
  const highPercent = ((highValue - min) / (max - min)) * 100;
  const lowPosition = mode === "score" ? 100 - lowPercent : lowPercent;
  const highPosition = mode === "score" ? 100 - highPercent : highPercent;
  const style = {
    "--range-low": `${lowPosition}%`,
    "--range-high": `${highPosition}%`
  } as React.CSSProperties;

  return (
    <div className={`admin-range-setting ${mode === "score" ? "score-mode" : ""}`} style={style}>
      <div className="admin-range-head">
        <div>
          <strong>{title}</strong>
          <span>{description}</span>
        </div>
        <div className="admin-range-values">
          <b className="high">
            {mode === "score" ? (
              <>
                达到 {highValue} {unit}奖励
              </>
            ) : (
              <>
                {highLabel} {highValue}
                {unit}
              </>
            )}
          </b>
          <b className="low">
            {mode === "score" ? (
              <>
                低于 {lowValue}
                {" "}
                {unit}扣钱
              </>
            ) : (
              <>
                {lowLabel} {lowValue}
                {unit}
              </>
            )}
          </b>
        </div>
      </div>
      <div className="admin-range-slider">
        <input
          className="low"
          type="range"
          min={min}
          max={max}
          step={1}
          value={lowValue}
          style={mode === "score" ? ({ direction: "rtl" } as React.CSSProperties) : undefined}
          onChange={(event) => onLowChange(Math.min(Number(event.target.value), highValue))}
          aria-label={lowLabel}
        />
        <input
          className="high"
          type="range"
          min={min}
          max={max}
          step={1}
          value={highValue}
          style={mode === "score" ? ({ direction: "rtl" } as React.CSSProperties) : undefined}
          onChange={(event) => onHighChange(Math.max(Number(event.target.value), lowValue))}
          aria-label={highLabel}
        />
        {mode === "score" ? (
          <div className="range-thumb-label-rail" aria-hidden="true">
            <span className="range-thumb-label high">{highValue}</span>
            <span className="range-thumb-label low">{lowValue}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(Math.round(value), min), max);
}

function AdminMoneyRangeSetting({
  rewardLow,
  rewardHigh,
  penaltyLow,
  penaltyHigh,
  onRewardLowChange,
  onRewardHighChange,
  onPenaltyLowChange,
  onPenaltyHighChange
}: {
  rewardLow: number;
  rewardHigh: number;
  penaltyLow: number;
  penaltyHigh: number;
  onRewardLowChange: (value: number) => void;
  onRewardHighChange: (value: number) => void;
  onPenaltyLowChange: (value: number) => void;
  onPenaltyHighChange: (value: number) => void;
}) {
  const min = 1;
  const max = 10;
  const rewardMin = Math.min(clampNumber(rewardLow, min, max), clampNumber(rewardHigh, min, max));
  const rewardMax = Math.max(clampNumber(rewardLow, min, max), clampNumber(rewardHigh, min, max));
  const penaltyMin = Math.min(clampNumber(penaltyLow, min, max), clampNumber(penaltyHigh, min, max));
  const penaltyMax = Math.max(clampNumber(penaltyLow, min, max), clampNumber(penaltyHigh, min, max));
  const pct = (value: number) => ((value - min) / (max - min)) * 100;
  const rewardStyle = {
    "--lane-low": `${pct(rewardMin)}%`,
    "--lane-high": `${pct(rewardMax)}%`
  } as React.CSSProperties;
  const penaltyStyle = {
    "--lane-low": `${pct(penaltyMin)}%`,
    "--lane-high": `${pct(penaltyMax)}%`
  } as React.CSSProperties;

  return (
    <div className="admin-money-range-setting">
      <div className="admin-range-head">
        <div>
          <strong>奖惩金额设定</strong>
          <span>设定奖惩金额随机区间。</span>
        </div>
        <div className="admin-range-values money-values">
          <b>
            奖励 {rewardMin}-{rewardMax}元
          </b>
          <b>
            扣除 {penaltyMin}-{penaltyMax}元
          </b>
        </div>
      </div>
      <div className="admin-money-ruler">
        <div className="money-lane reward" style={rewardStyle}>
          <div className="money-lane-meta">
            <span>奖励区间</span>
            <b>
              {rewardMin}-{rewardMax}元
            </b>
          </div>
          <div className="money-lane-control">
            <div className="money-lane-track">
              <span />
            </div>
            <input
              className="low"
              type="range"
              min={min}
              max={max}
              step={1}
              value={rewardMin}
              onChange={(event) => onRewardLowChange(Math.min(Number(event.target.value), rewardMax))}
              aria-label="奖励金额下限"
            />
            <input
              className="high"
              type="range"
              min={min}
              max={max}
              step={1}
              value={rewardMax}
              onChange={(event) => onRewardHighChange(Math.max(Number(event.target.value), rewardMin))}
              aria-label="奖励金额上限"
            />
            <div className="money-thumb-label-rail" aria-hidden="true">
              <span className="money-thumb-label low">{rewardMin}</span>
              {rewardMax !== rewardMin ? <span className="money-thumb-label high">{rewardMax}</span> : null}
            </div>
          </div>
        </div>
        <div className="money-lane penalty" style={penaltyStyle}>
          <div className="money-lane-meta">
            <span>扣除区间</span>
            <b>
              {penaltyMin}-{penaltyMax}元
            </b>
          </div>
          <div className="money-lane-control">
            <div className="money-lane-track">
              <span />
            </div>
            <input
              className="low"
              type="range"
              min={min}
              max={max}
              step={1}
              value={penaltyMin}
              onChange={(event) => onPenaltyLowChange(Math.min(Number(event.target.value), penaltyMax))}
              aria-label="低分扣除金额下限"
            />
            <input
              className="high"
              type="range"
              min={min}
              max={max}
              step={1}
              value={penaltyMax}
              onChange={(event) => onPenaltyHighChange(Math.max(Number(event.target.value), penaltyMin))}
              aria-label="低分扣除金额上限"
            />
            <div className="money-thumb-label-rail" aria-hidden="true">
              <span className="money-thumb-label low">{penaltyMin}</span>
              {penaltyMax !== penaltyMin ? <span className="money-thumb-label high">{penaltyMax}</span> : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

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
type AdminModelSettingsData = {
  baseUrl: string;
  model: string;
  timeoutMs: number;
  configured: boolean;
  apiKeySet: boolean;
  updatedAt: string | null;
};

type AdminTtsSettingsData = {
  provider: "openai-compatible" | "volcengine";
  baseUrl: string;
  model: string;
  voice: string;
  format: string;
  timeoutMs: number;
  appId: string;
  cluster: string;
  voiceType: string;
  encoding: string;
  configured: boolean;
  apiKeySet: boolean;
  accessTokenSet: boolean;
  updatedAt: string | null;
};

type ModelHistoryKind = "grading" | "tts" | "siri";
type ModelHistoryStatus = "success" | "error";
type AdminModelHistorySummary = {
  id: number;
  kind: ModelHistoryKind;
  operation: string;
  refType: string | null;
  refId: string | null;
  status: ModelHistoryStatus;
  provider: string | null;
  model: string | null;
  errorMessage: string | null;
  durationMs: number | null;
  createdAt: string;
  requestPreview: string;
  responsePreview: string;
};

type AdminModelHistoryDetail = AdminModelHistorySummary & {
  request: unknown;
  response: unknown;
};

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

function visibleWordTagIds(ids: string[], tags: WordTag[]): string[] {
  const visible = new Set(tags.map((tag) => tag.id));
  return ids.filter((id) => id !== "all" && visible.has(id));
}

function normalizeVisibleWordTags(ids: string[], tags: WordTag[]): string[] {
  const unique = [...new Set(visibleWordTagIds(ids, tags))];
  const hasConcreteTag = unique.some((id) => id !== "uncategorized");
  if (hasConcreteTag) return unique.filter((id) => id !== "uncategorized");
  return ["uncategorized"];
}

function availableWordTagsForInlineEdit(ids: string[], tags: WordTag[]): WordTag[] {
  const current = visibleWordTagIds(ids, tags);
  const hasConcreteTag = current.some((id) => id !== "uncategorized");
  return tags.filter((tag) => !current.includes(tag.id) && (!hasConcreteTag || tag.id !== "uncategorized"));
}

function adminWordTagTone(id: string): string {
  if (id === "shanghai-zhongkao") return " primary";
  if (id === "senior-candidate") return " senior";
  return "";
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
  const [section, setSection] = useState<"questions" | "words" | "practice" | "model" | "history" | "wallet">("questions");

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
              题库与设置
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
        <button className={section === "practice" ? "active" : ""} onClick={() => setSection("practice")}>
          <ListChecks size={19} />
          练习
        </button>
        <button className={section === "model" ? "active" : ""} onClick={() => setSection("model")}>
          <Settings size={19} />
          模型
        </button>
        <button className={section === "history" ? "active" : ""} onClick={() => setSection("history")}>
          <History size={19} />
          历史
        </button>
        <button className={section === "wallet" ? "active" : ""} onClick={() => setSection("wallet")}>
          <Wallet size={19} />
          钱包
        </button>
      </nav>
      {section === "questions" ? (
        <AdminQuestions />
      ) : section === "words" ? (
        <AdminWords />
      ) : section === "practice" ? (
        <AdminPracticeSettings />
      ) : section === "model" ? (
        <AdminModelSettings />
      ) : section === "history" ? (
        <AdminModelHistory />
      ) : (
        <AdminWallet />
      )}
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

function AdminPracticeSettings() {
  const [juniorBatchSize, setJuniorBatchSize] = useState("5");
  const [seniorBatchSize, setSeniorBatchSize] = useState("10");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [junior, senior] = await Promise.all([
        api(`/api/word/settings?${wordProfileQuery("junior")}`),
        api(`/api/word/settings?${wordProfileQuery("senior")}`)
      ]);
      setJuniorBatchSize(String(junior.batchSize || 5));
      setSeniorBatchSize(String(senior.batchSize || 10));
    } catch (err) {
      setError(err instanceof Error ? err.message : "练习配置加载失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setSaved(false);
    try {
      const body = (batchSize: string) => ({
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batchSize: Number(batchSize) })
      });
      const [junior, senior] = await Promise.all([
        api(`/api/word/settings?${wordProfileQuery("junior")}`, body(juniorBatchSize)),
        api(`/api/word/settings?${wordProfileQuery("senior")}`, body(seniorBatchSize))
      ]);
      setJuniorBatchSize(String(junior.batchSize || 5));
      setSeniorBatchSize(String(senior.batchSize || 10));
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "练习配置保存失败");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="admin-panel">
      <div className="admin-settings-head">
        <div>
          <span className="admin-status ready">练习配置</span>
          <h2>词汇练习设置</h2>
        </div>
      </div>
      {loading ? <LoadingScreen compact /> : null}
      {error ? <div className="notice danger">{error}</div> : null}
      {saved ? <div className="notice">练习配置已保存。</div> : null}
      {!loading ? (
        <form className="admin-form admin-settings-form" onSubmit={save}>
          <label>
            中考词汇每组词数
            <input
              type="number"
              min={1}
              max={30}
              step={1}
              value={juniorBatchSize}
              onChange={(event) => setJuniorBatchSize(event.target.value)}
              required
            />
          </label>
          <label>
            高考词汇每组词数
            <input
              type="number"
              min={1}
              max={30}
              step={1}
              value={seniorBatchSize}
              onChange={(event) => setSeniorBatchSize(event.target.value)}
              required
            />
          </label>
          <div className="admin-form-actions">
            <button className="primary-button small" disabled={submitting}>
              {submitting ? <Loader2 className="spin" size={18} /> : <Check size={18} />}
              保存配置
            </button>
          </div>
        </form>
      ) : null}
    </section>
  );
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
              {questionSeasonLabel(s.season)}（{s.questionCount}）
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
              <span className="admin-tag">{`${questionSeasonLabel(item.season)} · Day ${item.day} · Question ${item.questionNo}`}</span>
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
    <AdminModal className="admin-question-modal" title={isNew ? "新建题目" : `编辑 ${question.id}`} onClose={onClose}>
      <form className="admin-form admin-question-form" onSubmit={submit}>
        {isNew ? (
          <div className="admin-form-grid">
            <label>
              Season
              <select value={season} onChange={(e) => setSeason(e.target.value)} required>
                <option value="" disabled>选择 Season</option>
                {ADMIN_QUESTION_SEASON_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Day
              <select value={day} onChange={(e) => setDay(e.target.value)} required>
                <option value="" disabled>选择 Day</option>
                {ADMIN_QUESTION_DAY_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    Day {option}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Question
              <select value={questionNo} onChange={(e) => setQuestionNo(e.target.value)} required>
                <option value="" disabled>选择 Question</option>
                {ADMIN_QUESTION_NO_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    Question {option}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : (
          <div className="admin-meta-row">
            <div className="admin-meta-item">
              <span className="admin-meta-label">Season</span>
              <span className="admin-meta-value">{questionSeasonLabel(season)}</span>
            </div>
            <div className="admin-meta-item">
              <span className="admin-meta-label">Day</span>
              <span className="admin-meta-value">{day}</span>
            </div>
            <div className="admin-meta-item">
              <span className="admin-meta-label">Question</span>
              <span className="admin-meta-value">{questionNo}</span>
            </div>
          </div>
        )}
        {!isNew ? <p className="admin-hint">Season / Day / Question 决定题目 ID，不可修改；如需调整请删除后重建。</p> : null}
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
  const [locateTerm, setLocateTerm] = useState("");
  const [locateNotice, setLocateNotice] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [letterFilter, setLetterFilter] = useState("");
  const debouncedSearch = useDebounced(search);
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<AdminWord | "new" | null>(null);
  const [deleting, setDeleting] = useState<AdminWord | null>(null);
  const [generatingAudioId, setGeneratingAudioId] = useState<string | null>(null);
  const [tagMenuWordId, setTagMenuWordId] = useState<string | null>(null);
  const [savingTagWordId, setSavingTagWordId] = useState<string | null>(null);
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
    setLocateNotice("");
  }, [debouncedSearch, tagFilter, letterFilter]);

  async function locateWordPage(event: React.FormEvent) {
    event.preventDefault();
    const term = locateTerm.trim();
    if (!term) {
      setLocateNotice("请先输入要定位的单词。");
      return;
    }
    setLocating(true);
    setError("");
    setLocateNotice("");
    try {
      const params = new URLSearchParams({ word: term, limit: String(ADMIN_PAGE_SIZE) });
      if (debouncedSearch) params.set("q", debouncedSearch);
      if (tagFilter) params.set("tag", tagFilter);
      if (letterFilter) params.set("letter", letterFilter);
      const data = await api(`/api/admin/words/locate?${params.toString()}`);
      const nextOffset = Number(data.offset) || 0;
      const page = Number(data.page) || Math.floor(nextOffset / ADMIN_PAGE_SIZE) + 1;
      const index = Number(data.index);
      const position = Number.isFinite(index) ? `，第 ${index + 1} 条` : "";
      setOffset(nextOffset);
      setLocateNotice(`${data.word?.name || term} 在第 ${page} 页${position}。`);
    } catch (err) {
      setLocateNotice(err instanceof Error ? err.message : "定位失败");
    } finally {
      setLocating(false);
    }
  }

  async function generateAudio(item: AdminWord) {
    setGeneratingAudioId(item.id);
    setError("");
    try {
      const data = await api(`/api/admin/words/${encodeURIComponent(item.id)}/audio/generate`, { method: "POST" });
      await load();
      if (data?.audioGeneration?.status === "skipped" || data?.audioGeneration?.status === "failed") {
        setError(data.audioGeneration.message || "发音生成失败");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "发音生成失败");
    } finally {
      setGeneratingAudioId(null);
    }
  }

  async function updateWordTags(item: AdminWord, nextTags: string[]) {
    const normalizedTags = normalizeVisibleWordTags(nextTags, wordTags);
    const previousItems = items;
    setSavingTagWordId(item.id);
    setTagMenuWordId(null);
    setError("");
    setItems((prev) => prev.map((word) => (word.id === item.id ? { ...word, tags: ["all", ...normalizedTags] } : word)));
    try {
      await api(`/api/admin/words/${encodeURIComponent(item.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: item.name,
          definitions: item.definitions,
          examples: item.examples,
          tags: normalizedTags
        })
      });
      await load();
    } catch (err) {
      setItems(previousItems);
      setError(err instanceof Error ? err.message : "分类保存失败");
    } finally {
      setSavingTagWordId(null);
    }
  }

  return (
    <section className="admin-panel">
      <div className="admin-toolbar">
        <div className="admin-search">
          <Search size={18} />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索单词或释义" />
        </div>
        <form className="admin-locate" onSubmit={locateWordPage}>
          <Search size={18} />
          <input
            value={locateTerm}
            onChange={(event) => setLocateTerm(event.target.value)}
            placeholder="定位单词"
            aria-label="定位单词"
          />
          <button type="submit" className="admin-locate-button" disabled={locating}>
            {locating ? <Loader2 className="spin" size={16} /> : <ArrowRight size={16} />}
            定位
          </button>
        </form>
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
      {locateNotice ? <p className="admin-locate-note">{locateNotice}</p> : null}

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
                <button
                  type="button"
                  className="admin-audio-button"
                  title={item.hasAudio ? "重新生成发音" : "生成发音"}
                  onClick={() => generateAudio(item)}
                  disabled={generatingAudioId === item.id}
                >
                  {generatingAudioId === item.id ? (
                    <Loader2 className="spin admin-audio" size={15} />
                  ) : item.hasAudio ? (
                    <RefreshCw size={15} className="admin-audio" />
                  ) : (
                    <Volume2 size={15} className="admin-audio missing" />
                  )}
                </button>
              </p>
              <p className="admin-sub">
                {item.definitions.map((d) => `${d.partOfSpeech || ""} ${d.meaning}`.trim()).join("；")}
              </p>
              {item.examples[0]?.english ? <p className="admin-ans">例：{item.examples[0].english}</p> : null}
              <div className="admin-tag-chips">
                {visibleWordTagIds(item.tags, wordTags).map((t) => (
                  <span key={t} className={`admin-chip editable${adminWordTagTone(t)}`}>
                    {tagLabel(wordTags, t)}
                    <button
                      type="button"
                      className="admin-chip-remove"
                      title={`移除 ${tagLabel(wordTags, t)}`}
                      aria-label={`移除 ${tagLabel(wordTags, t)}`}
                      disabled={savingTagWordId === item.id}
                      onClick={() => updateWordTags(item, visibleWordTagIds(item.tags, wordTags).filter((id) => id !== t))}
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
                <span className="admin-tag-add-wrap">
                  <button
                    type="button"
                    className="admin-chip-add"
                    title="添加分类"
                    aria-label={`给 ${item.name} 添加分类`}
                    disabled={savingTagWordId === item.id}
                    onClick={() => setTagMenuWordId((current) => (current === item.id ? null : item.id))}
                  >
                    {savingTagWordId === item.id ? <Loader2 className="spin" size={13} /> : <Plus size={13} />}
                  </button>
                  {tagMenuWordId === item.id ? (
                    <div className="admin-tag-menu">
                      {availableWordTagsForInlineEdit(item.tags, wordTags).map((tag) => (
                        <button
                          key={tag.id}
                          type="button"
                          className={`admin-tag-menu-item${adminWordTagTone(tag.id)}`}
                          onClick={() => updateWordTags(item, [...visibleWordTagIds(item.tags, wordTags), tag.id])}
                        >
                          {tag.label}
                        </button>
                      ))}
                      {availableWordTagsForInlineEdit(item.tags, wordTags).length === 0 ? (
                        <span className="admin-tag-menu-empty">没有可添加分类</span>
                      ) : null}
                    </div>
                  ) : null}
                </span>
              </div>
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

      <AdminPager total={total} offset={offset} onOffset={setOffset} showPageJump />

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

function AdminModelSettings() {
  const [settings, setSettings] = useState<AdminModelSettingsData | null>(null);
  const [ttsSettings, setTtsSettings] = useState<AdminTtsSettingsData | null>(null);
  const [baseUrl, setBaseUrl] = useState("");
  const [model, setModel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [timeoutMs, setTimeoutMs] = useState("30000");
  const [ttsProvider, setTtsProvider] = useState<AdminTtsSettingsData["provider"]>("volcengine");
  const [ttsBaseUrl, setTtsBaseUrl] = useState("");
  const [ttsApiKey, setTtsApiKey] = useState("");
  const [ttsModel, setTtsModel] = useState("");
  const [ttsVoice, setTtsVoice] = useState("");
  const [ttsFormat, setTtsFormat] = useState("mp3");
  const [ttsAppId, setTtsAppId] = useState("");
  const [ttsAccessToken, setTtsAccessToken] = useState("");
  const [ttsCluster, setTtsCluster] = useState("");
  const [ttsVoiceType, setTtsVoiceType] = useState("");
  const [ttsEncoding, setTtsEncoding] = useState("mp3");
  const [ttsTimeoutMs, setTtsTimeoutMs] = useState("30000");
  const [loading, setLoading] = useState(true);
  const [submittingGrade, setSubmittingGrade] = useState(false);
  const [testingGrade, setTestingGrade] = useState(false);
  const [submittingTts, setSubmittingTts] = useState(false);
  const [testingTts, setTestingTts] = useState(false);
  const [error, setError] = useState("");
  const [gradeSaved, setGradeSaved] = useState(false);
  const [ttsSaved, setTtsSaved] = useState(false);
  const [gradeTestResult, setGradeTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [ttsTestResult, setTtsTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  async function load() {
    setLoading(true);
    setError("");
    setGradeSaved(false);
    setTtsSaved(false);
    setGradeTestResult(null);
    setTtsTestResult(null);
    try {
      const [gradeData, ttsData] = (await Promise.all([
        api("/api/admin/model-settings"),
        api("/api/admin/tts-settings")
      ])) as [AdminModelSettingsData, AdminTtsSettingsData];
      setSettings(gradeData);
      setBaseUrl(gradeData.baseUrl);
      setModel(gradeData.model);
      setTimeoutMs(String(gradeData.timeoutMs || 30000));
      setApiKey("");
      setTtsSettings(ttsData);
      setTtsProvider(ttsData.provider);
      setTtsBaseUrl(ttsData.baseUrl);
      setTtsModel(ttsData.model);
      setTtsVoice(ttsData.voice);
      setTtsFormat(ttsData.format || "mp3");
      setTtsTimeoutMs(String(ttsData.timeoutMs || 30000));
      setTtsAppId(ttsData.appId);
      setTtsAccessToken("");
      setTtsCluster(ttsData.cluster);
      setTtsVoiceType(ttsData.voiceType);
      setTtsEncoding(ttsData.encoding || ttsData.format || "mp3");
    } catch (err) {
      setError(err instanceof Error ? err.message : "模型配置加载失败");
    } finally {
      setLoading(false);
    }
  }

  function markChanged() {
    setGradeSaved(false);
    setGradeTestResult(null);
  }

  function markTtsChanged() {
    setTtsSaved(false);
    setTtsTestResult(null);
  }

  useEffect(() => {
    load();
  }, []);

  async function testGradeConnection() {
    setTestingGrade(true);
    setError("");
    setGradeSaved(false);
    setGradeTestResult(null);
    try {
      const data = await api("/api/admin/model-settings/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseUrl,
          model,
          apiKey,
          timeoutMs: Number(timeoutMs)
        })
      });
      setGradeTestResult({ ok: true, message: data.message || "模型连接测试通过。" });
    } catch (err) {
      setGradeTestResult({ ok: false, message: err instanceof Error ? err.message : "模型连接测试失败" });
    } finally {
      setTestingGrade(false);
    }
  }

  async function submitGrade(event: React.FormEvent) {
    event.preventDefault();
    setSubmittingGrade(true);
    setError("");
    setGradeSaved(false);
    try {
      const data = (await api("/api/admin/model-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseUrl,
          model,
          apiKey,
          timeoutMs: Number(timeoutMs)
        })
      })) as AdminModelSettingsData;
      setSettings(data);
      setBaseUrl(data.baseUrl);
      setModel(data.model);
      setTimeoutMs(String(data.timeoutMs));
      setApiKey("");
      setGradeSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSubmittingGrade(false);
    }
  }

  function ttsPayload() {
    return {
      provider: ttsProvider,
      baseUrl: ttsBaseUrl,
      apiKey: ttsApiKey,
      model: ttsModel,
      voice: ttsVoice,
      format: ttsFormat,
      timeoutMs: Number(ttsTimeoutMs),
      appId: ttsAppId,
      accessToken: ttsAccessToken,
      cluster: ttsCluster,
      voiceType: ttsVoiceType,
      encoding: ttsEncoding
    };
  }

  async function testTtsConnection() {
    setTestingTts(true);
    setError("");
    setTtsSaved(false);
    setTtsTestResult(null);
    try {
      const data = await api("/api/admin/tts-settings/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ttsPayload())
      });
      setTtsTestResult({ ok: true, message: data.message || "TTS 连接测试通过。" });
    } catch (err) {
      setTtsTestResult({ ok: false, message: err instanceof Error ? err.message : "TTS 连接测试失败" });
    } finally {
      setTestingTts(false);
    }
  }

  async function submitTts(event: React.FormEvent) {
    event.preventDefault();
    setSubmittingTts(true);
    setError("");
    setTtsSaved(false);
    try {
      const data = (await api("/api/admin/tts-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ttsPayload())
      })) as AdminTtsSettingsData;
      setTtsSettings(data);
      setTtsProvider(data.provider);
      setTtsBaseUrl(data.baseUrl);
      setTtsModel(data.model);
      setTtsVoice(data.voice);
      setTtsFormat(data.format || "mp3");
      setTtsTimeoutMs(String(data.timeoutMs));
      setTtsAppId(data.appId);
      setTtsAccessToken("");
      setTtsCluster(data.cluster);
      setTtsVoiceType(data.voiceType);
      setTtsEncoding(data.encoding || data.format || "mp3");
      setTtsSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSubmittingTts(false);
    }
  }

  return (
    <section className="admin-panel">
      <div className="admin-settings-head">
        <div>
          <span className={`admin-status ${settings?.configured && ttsSettings?.configured ? "ready" : "missing"}`}>
            {settings?.configured && ttsSettings?.configured ? "已配置" : "待完善"}
          </span>
          <h2>模型参数</h2>
        </div>
        {settings?.updatedAt || ttsSettings?.updatedAt ? (
          <small>最近更新 {formatDate(ttsSettings?.updatedAt || settings?.updatedAt || "")}</small>
        ) : null}
      </div>

      {loading ? <LoadingScreen compact /> : null}
      {error ? <div className="notice danger">{error}</div> : null}

      {!loading ? (
        <div className="admin-model-grid">
          <form className="admin-form admin-settings-form admin-model-form" onSubmit={submitGrade}>
            <div className="admin-form-heading">
              <div>
                <span className={`admin-status ${settings?.configured ? "ready" : "missing"}`}>
                  {settings?.configured ? "已配置" : "未配置"}
                </span>
                <h3>批改模型</h3>
              </div>
              {settings?.updatedAt ? <small>更新于 {formatDate(settings.updatedAt)}</small> : null}
            </div>
            <label>
              Base URL
              <input
                value={baseUrl}
                onChange={(event) => {
                  setBaseUrl(event.target.value);
                  markChanged();
                }}
                placeholder="https://api.deepseek.com"
                required
              />
            </label>
            <label>
              模型名称
              <input
                value={model}
                onChange={(event) => {
                  setModel(event.target.value);
                  markChanged();
                }}
                placeholder="deepseek-v4-flash"
                required
              />
            </label>
            <label>
              API Key
              <input
                type="password"
                value={apiKey}
                onChange={(event) => {
                  setApiKey(event.target.value);
                  markChanged();
                }}
                placeholder={settings?.apiKeySet ? "已保存，留空不变" : "请输入 API Key"}
                required={!settings?.apiKeySet}
              />
            </label>
            <label>
              超时（毫秒）
              <input
                type="number"
                min={1000}
                max={120000}
                step={1000}
                value={timeoutMs}
                onChange={(event) => {
                  setTimeoutMs(event.target.value);
                  markChanged();
                }}
                required
              />
            </label>
            {gradeSaved ? <div className="notice">批改模型配置已保存。</div> : null}
            {gradeTestResult ? (
              <div className={`notice ${gradeTestResult.ok ? "" : "danger"}`}>{gradeTestResult.message}</div>
            ) : null}
            <div className="admin-form-actions">
              <button type="button" className="link-button" onClick={load} disabled={submittingGrade || submittingTts}>
                <RotateCcw size={16} />
                重新加载
              </button>
              <button
                type="button"
                className="soft-button small"
                onClick={testGradeConnection}
                disabled={submittingGrade || testingGrade}
              >
                {testingGrade ? <Loader2 className="spin" size={18} /> : <Sparkles size={18} />}
                测试连接
              </button>
              <button className="primary-button small" disabled={submittingGrade}>
                {submittingGrade ? <Loader2 className="spin" size={18} /> : <Check size={18} />}
                保存批改模型
              </button>
            </div>
          </form>

          <form className="admin-form admin-settings-form admin-model-form" onSubmit={submitTts}>
            <div className="admin-form-heading">
              <div>
                <span className={`admin-status ${ttsSettings?.configured ? "ready" : "missing"}`}>
                  {ttsSettings?.configured ? "已配置" : "未配置"}
                </span>
                <h3>TTS 发音模型</h3>
              </div>
              {ttsSettings?.updatedAt ? <small>更新于 {formatDate(ttsSettings.updatedAt)}</small> : null}
            </div>
            <label>
              Provider
              <select
                value={ttsProvider}
                onChange={(event) => {
                  const provider = event.target.value as AdminTtsSettingsData["provider"];
                  setTtsProvider(provider);
                  setTtsBaseUrl(
                    provider === "volcengine"
                      ? ttsBaseUrl || "https://openspeech.bytedance.com/api/v3/tts/unidirectional"
                      : ttsBaseUrl || "https://api.openai.com"
                  );
                  markTtsChanged();
                }}
              >
                <option value="volcengine">火山引擎</option>
                <option value="openai-compatible">OpenAI-compatible</option>
              </select>
            </label>
            <label>
              Base URL
              <input
                value={ttsBaseUrl}
                onChange={(event) => {
                  setTtsBaseUrl(event.target.value);
                  markTtsChanged();
                }}
                placeholder={
                  ttsProvider === "volcengine"
                    ? "https://openspeech.bytedance.com/api/v3/tts/unidirectional"
                    : "https://api.openai.com"
                }
                required
              />
            </label>
            {ttsProvider === "volcengine" ? (
              <>
                <label>
                  App ID（旧版可选）
                  <input
                    value={ttsAppId}
                    onChange={(event) => {
                      setTtsAppId(event.target.value);
                      markTtsChanged();
                    }}
                    placeholder="新版 API Key 模式可留空"
                  />
                </label>
                <label>
                  API Key
                  <input
                    type="password"
                    value={ttsAccessToken}
                    onChange={(event) => {
                      setTtsAccessToken(event.target.value);
                      markTtsChanged();
                    }}
                    placeholder={ttsSettings?.accessTokenSet ? "已保存，留空不变" : "请输入 API Key"}
                    required={!ttsSettings?.accessTokenSet}
                  />
                </label>
                <label>
                  Resource ID
                  <input
                    value={ttsCluster}
                    onChange={(event) => {
                      setTtsCluster(event.target.value);
                      markTtsChanged();
                    }}
                    placeholder="seed-tts-2.0"
                    required
                  />
                </label>
                <label>
                  Speaker
                  <input
                    value={ttsVoiceType}
                    onChange={(event) => {
                      setTtsVoiceType(event.target.value);
                      markTtsChanged();
                    }}
                    placeholder="zh_female_cancan_mars_bigtts"
                    required
                  />
                </label>
                <label>
                  Encoding
                  <input
                    value={ttsEncoding}
                    onChange={(event) => {
                      setTtsEncoding(event.target.value);
                      markTtsChanged();
                    }}
                    placeholder="mp3"
                    required
                  />
                </label>
              </>
            ) : (
              <>
                <label>
                  API Key
                  <input
                    type="password"
                    value={ttsApiKey}
                    onChange={(event) => {
                      setTtsApiKey(event.target.value);
                      markTtsChanged();
                    }}
                    placeholder={ttsSettings?.apiKeySet ? "已保存，留空不变" : "请输入 API Key"}
                    required={!ttsSettings?.apiKeySet}
                  />
                </label>
                <label>
                  Model
                  <input
                    value={ttsModel}
                    onChange={(event) => {
                      setTtsModel(event.target.value);
                      markTtsChanged();
                    }}
                    placeholder="gpt-4o-mini-tts"
                    required
                  />
                </label>
                <label>
                  Voice
                  <input
                    value={ttsVoice}
                    onChange={(event) => {
                      setTtsVoice(event.target.value);
                      markTtsChanged();
                    }}
                    placeholder="alloy"
                    required
                  />
                </label>
                <label>
                  Format
                  <input
                    value={ttsFormat}
                    onChange={(event) => {
                      setTtsFormat(event.target.value);
                      markTtsChanged();
                    }}
                    placeholder="mp3"
                    required
                  />
                </label>
              </>
            )}
            <label>
              超时（毫秒）
              <input
                type="number"
                min={1000}
                max={120000}
                step={1000}
                value={ttsTimeoutMs}
                onChange={(event) => {
                  setTtsTimeoutMs(event.target.value);
                  markTtsChanged();
                }}
                required
              />
            </label>
            {ttsSaved ? <div className="notice">TTS 发音模型配置已保存。</div> : null}
            {ttsTestResult ? <div className={`notice ${ttsTestResult.ok ? "" : "danger"}`}>{ttsTestResult.message}</div> : null}
            <div className="admin-form-actions">
              <button type="button" className="link-button" onClick={load} disabled={submittingTts || submittingGrade}>
                <RotateCcw size={16} />
                重新加载
              </button>
              <button
                type="button"
                className="soft-button small"
                onClick={testTtsConnection}
                disabled={submittingTts || testingTts}
              >
                {testingTts ? <Loader2 className="spin" size={18} /> : <Volume2 size={18} />}
                测试发音
              </button>
              <button className="primary-button small" disabled={submittingTts}>
                {submittingTts ? <Loader2 className="spin" size={18} /> : <Check size={18} />}
                保存 TTS
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </section>
  );
}

function AdminModelHistory() {
  const [items, setItems] = useState<AdminModelHistorySummary[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [kind, setKind] = useState("");
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounced(search);
  const [loading, setLoading] = useState(false);
  const [detailLoadingId, setDetailLoadingId] = useState<number | null>(null);
  const [detail, setDetail] = useState<AdminModelHistoryDetail | null>(null);
  const [error, setError] = useState("");

  async function load(nextOffset = offset) {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ limit: String(ADMIN_PAGE_SIZE), offset: String(nextOffset) });
      if (kind) params.set("kind", kind);
      if (status) params.set("status", status);
      if (debouncedSearch) params.set("q", debouncedSearch);
      const data = await api(`/api/admin/model-history?${params.toString()}`);
      setItems(data.items);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "模型历史加载失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, status, debouncedSearch, offset]);

  useEffect(() => {
    setOffset(0);
  }, [kind, status, debouncedSearch]);

  async function openDetail(item: AdminModelHistorySummary) {
    setDetailLoadingId(item.id);
    setError("");
    try {
      const data = (await api(`/api/admin/model-history/${item.id}`)) as AdminModelHistoryDetail;
      setDetail(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "模型历史详情加载失败");
    } finally {
      setDetailLoadingId(null);
    }
  }

  return (
    <section className="admin-panel model-history-panel">
      <div className="admin-toolbar">
        <div className="admin-search">
          <Search size={18} />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索问题、单词、错误或响应内容" />
        </div>
        <select className="admin-filter" value={kind} onChange={(event) => setKind(event.target.value)}>
          <option value="">全部类型</option>
          <option value="grading">批改</option>
          <option value="tts">TTS</option>
          <option value="siri">Siri</option>
        </select>
        <select className="admin-filter" value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="">全部状态</option>
          <option value="success">成功</option>
          <option value="error">失败</option>
        </select>
        <button className="soft-button small" onClick={() => load(0)} disabled={loading}>
          {loading ? <Loader2 className="spin" size={18} /> : <RefreshCw size={18} />}
          刷新
        </button>
      </div>

      {error ? <div className="notice danger">{error}</div> : null}
      <p className="admin-count">共 {total} 条模型历史{loading ? "（加载中…）" : ""}</p>

      <div className="admin-list model-history-list">
        {items.map((item) => (
          <article key={item.id} className={`admin-row model-history-row ${item.status}`}>
            <div className="admin-row-main">
              <div className="model-history-title">
                <span className={`admin-status ${item.status === "success" ? "ready" : "missing"}`}>
                  {modelHistoryStatusLabel(item.status)}
                </span>
                <strong>{modelHistoryOperationLabel(item.operation)}</strong>
                <small>{formatDate(item.createdAt)}</small>
              </div>
              <p className="admin-sub">
                {modelHistoryKindLabel(item.kind)}
                {item.refId ? ` · ${item.refId}` : ""}
                {item.model ? ` · ${item.model}` : item.provider ? ` · ${item.provider}` : ""}
                {item.durationMs !== null ? ` · ${item.durationMs}ms` : ""}
              </p>
              <pre className="model-history-preview">
                {item.errorMessage || item.responsePreview || item.requestPreview || "没有响应内容"}
              </pre>
            </div>
            <div className="admin-row-actions">
              <button className="icon-button" title="查看详情" onClick={() => openDetail(item)} disabled={detailLoadingId === item.id}>
                {detailLoadingId === item.id ? <Loader2 className="spin" size={18} /> : <History size={18} />}
              </button>
            </div>
          </article>
        ))}
        {!loading && items.length === 0 ? <p className="admin-empty">没有匹配的模型历史。</p> : null}
      </div>

      <AdminPager total={total} offset={offset} onOffset={setOffset} />

      {detail ? (
        <AdminModal className="admin-history-modal" title={`模型历史 #${detail.id}`} onClose={() => setDetail(null)}>
          <div className="model-history-detail-meta">
            <span className={`admin-status ${detail.status === "success" ? "ready" : "missing"}`}>
              {modelHistoryStatusLabel(detail.status)}
            </span>
            <span>{modelHistoryKindLabel(detail.kind)}</span>
            <span>{modelHistoryOperationLabel(detail.operation)}</span>
            {detail.refId ? <span>{detail.refId}</span> : null}
            {detail.durationMs !== null ? <span>{detail.durationMs}ms</span> : null}
          </div>
          {detail.errorMessage ? <div className="notice danger">{detail.errorMessage}</div> : null}
          <div className="model-history-json-grid">
            <section>
              <h3>请求</h3>
              <pre>{formatJson(detail.request)}</pre>
            </section>
            <section>
              <h3>响应</h3>
              <pre>{formatJson(detail.response)}</pre>
            </section>
          </div>
        </AdminModal>
      ) : null}
    </section>
  );
}

function modelHistoryKindLabel(kind: string): string {
  if (kind === "grading") return "批改";
  if (kind === "tts") return "TTS";
  if (kind === "siri") return "Siri";
  return kind;
}

function modelHistoryStatusLabel(status: string): string {
  return status === "success" ? "成功" : "失败";
}

function modelHistoryOperationLabel(operation: string): string {
  const labels: Record<string, string> = {
    "sentence-grade": "中译英批改",
    "word-recall": "单词默写批改",
    "word-example": "例句默写批改",
    "model-test": "批改模型测试",
    "word-audio-generate": "单词发音生成",
    "tts-test": "TTS 发音测试",
    "siri-wallet-command": "Siri 钱包解析"
  };
  return labels[operation] || operation;
}

function formatJson(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

type AdminWalletSettingsData = {
  rewardScore: number;
  rewardMinCents: number;
  rewardMaxCents: number;
  penaltyScoreBelow: number;
  penaltyMinCents: number;
  penaltyMaxCents: number;
  withdrawThresholdCents: number;
  seniorWordRewardAverageAbove: number;
  seniorWordPenaltyAverageBelow: number;
  updatedAt: string | null;
};

// 表单内金额一律以"元"为单位展示和输入,提交时 ×100 转成分。
function yuanInputValue(cents: number): string {
  return String(cents / 100);
}

function AdminWallet() {
  const [rewardScore, setRewardScore] = useState("100");
  const [rewardMin, setRewardMin] = useState("1");
  const [rewardMax, setRewardMax] = useState("3");
  const [penaltyScoreBelow, setPenaltyScoreBelow] = useState("60");
  const [penaltyMin, setPenaltyMin] = useState("1");
  const [penaltyMax, setPenaltyMax] = useState("2");
  const [threshold, setThreshold] = useState("10");
  const [seniorRewardAverageAbove, setSeniorRewardAverageAbove] = useState("90");
  const [seniorPenaltyAverageBelow, setSeniorPenaltyAverageBelow] = useState("70");
  const [balanceCents, setBalanceCents] = useState(0);
  const [items, setItems] = useState<WalletTx[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [pendingWithdrawals, setPendingWithdrawals] = useState<WalletTx[]>([]);
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustNote, setAdjustNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [adjusting, setAdjusting] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  async function loadSettings() {
    const data = (await api("/api/admin/wallet-settings")) as AdminWalletSettingsData;
    setRewardScore(String(data.rewardScore));
    setRewardMin(yuanInputValue(data.rewardMinCents));
    setRewardMax(yuanInputValue(data.rewardMaxCents));
    setPenaltyScoreBelow(String(data.penaltyScoreBelow));
    setPenaltyMin(yuanInputValue(data.penaltyMinCents));
    setPenaltyMax(yuanInputValue(data.penaltyMaxCents));
    setThreshold(yuanInputValue(data.withdrawThresholdCents));
    setSeniorRewardAverageAbove(String(data.seniorWordRewardAverageAbove));
    setSeniorPenaltyAverageBelow(String(data.seniorWordPenaltyAverageBelow));
  }

  async function loadTransactions(nextOffset = offset) {
    const [pageData, withdrawData] = await Promise.all([
      api(`/api/admin/wallet/transactions?limit=${ADMIN_PAGE_SIZE}&offset=${nextOffset}`),
      api("/api/admin/wallet/transactions?type=withdraw&limit=100")
    ]);
    setItems(pageData.items);
    setTotal(pageData.total);
    setBalanceCents(pageData.balanceCents);
    setPendingWithdrawals((withdrawData.items as WalletTx[]).filter((tx) => tx.status === "pending"));
  }

  useEffect(() => {
    setLoading(true);
    setError("");
    Promise.all([loadSettings(), loadTransactions(0)])
      .catch((err) => setError(err instanceof Error ? err.message : "钱包数据加载失败"))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadTransactions(offset).catch((err) => setError(err instanceof Error ? err.message : "钱包流水加载失败"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offset]);

  async function saveSettings(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setSaved(false);
    try {
      const data = (await api("/api/admin/wallet-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rewardScore: Number(rewardScore),
          rewardMinCents: Math.round(Number(rewardMin) * 100),
          rewardMaxCents: Math.round(Number(rewardMax) * 100),
          penaltyScoreBelow: Number(penaltyScoreBelow),
          penaltyMinCents: Math.round(Number(penaltyMin) * 100),
          penaltyMaxCents: Math.round(Number(penaltyMax) * 100),
          withdrawThresholdCents: Math.round(Number(threshold) * 100),
          seniorWordRewardAverageAbove: Number(seniorRewardAverageAbove),
          seniorWordPenaltyAverageBelow: Number(seniorPenaltyAverageBelow)
        })
      })) as AdminWalletSettingsData;
      setRewardScore(String(data.rewardScore));
      setRewardMin(yuanInputValue(data.rewardMinCents));
      setRewardMax(yuanInputValue(data.rewardMaxCents));
      setPenaltyScoreBelow(String(data.penaltyScoreBelow));
      setPenaltyMin(yuanInputValue(data.penaltyMinCents));
      setPenaltyMax(yuanInputValue(data.penaltyMaxCents));
      setThreshold(yuanInputValue(data.withdrawThresholdCents));
      setSeniorRewardAverageAbove(String(data.seniorWordRewardAverageAbove));
      setSeniorPenaltyAverageBelow(String(data.seniorWordPenaltyAverageBelow));
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSubmitting(false);
    }
  }

  async function markPaid(id: number) {
    setError("");
    try {
      await api(`/api/admin/wallet/withdrawals/${id}/paid`, { method: "POST" });
      await loadTransactions();
    } catch (err) {
      setError(err instanceof Error ? err.message : "标记失败");
    }
  }

  async function adjust(event: React.FormEvent) {
    event.preventDefault();
    setAdjusting(true);
    setError("");
    try {
      await api("/api/admin/wallet/adjust", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountCents: Math.round(Number(adjustAmount) * 100), note: adjustNote })
      });
      setAdjustAmount("");
      setAdjustNote("");
      setOffset(0);
      await loadTransactions(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "调整失败");
    } finally {
      setAdjusting(false);
    }
  }

  return (
    <section className="admin-panel">
      <div className="admin-settings-head wallet-settings-head">
        <div className="wallet-settings-copy">
          <span className="admin-status ready">钱包设置</span>
          <h2>奖励与扣钱规则</h2>
          <p>设置中译英、词汇练习和高考词汇整组练习的钱包奖惩规则。</p>
        </div>
        <WalletCard balanceCents={balanceCents} />
      </div>

      {loading ? <LoadingScreen compact /> : null}
      {error ? <div className="notice danger">{error}</div> : null}
      {saved ? <div className="notice">钱包配置已保存。</div> : null}

      {!loading ? (
        <>
          <form className="admin-form admin-settings-form" onSubmit={saveSettings}>
            <AdminRangeSetting
              title="中译英及中考词汇奖惩分数线"
              description="左侧是高分奖励区，右侧是低分扣钱区，中间不奖不扣。"
              min={0}
              max={100}
              low={Number(penaltyScoreBelow)}
              high={Number(rewardScore)}
              lowLabel="扣钱低于"
              highLabel="奖励达到"
              unit="分"
              mode="score"
              onLowChange={(value) => setPenaltyScoreBelow(String(value))}
              onHighChange={(value) => setRewardScore(String(value))}
            />
            <AdminRangeSetting
              title="高考词汇平均分奖惩线"
              description="一组练完后按平均分结算。"
              min={0}
              max={100}
              low={Number(seniorPenaltyAverageBelow)}
              high={Number(seniorRewardAverageAbove)}
              lowLabel="扣钱低于"
              highLabel="奖励达到"
              unit="分"
              mode="score"
              onLowChange={(value) => setSeniorPenaltyAverageBelow(String(value))}
              onHighChange={(value) => setSeniorRewardAverageAbove(String(value))}
            />
            <AdminMoneyRangeSetting
              rewardLow={Number(rewardMin)}
              rewardHigh={Number(rewardMax)}
              penaltyLow={Number(penaltyMin)}
              penaltyHigh={Number(penaltyMax)}
              onRewardLowChange={(value) => setRewardMin(String(value))}
              onRewardHighChange={(value) => setRewardMax(String(value))}
              onPenaltyLowChange={(value) => setPenaltyMin(String(value))}
              onPenaltyHighChange={(value) => setPenaltyMax(String(value))}
            />
            <label>
              提现门槛（元）
              <input type="number" min={1} step={1} value={threshold} onChange={(event) => setThreshold(event.target.value)} required />
            </label>
            <div className="admin-form-actions">
              <button className="primary-button small" disabled={submitting}>
                {submitting ? <Loader2 className="spin" size={18} /> : <Check size={18} />}
                保存配置
              </button>
            </div>
          </form>

          {pendingWithdrawals.length ? (
            <div className="admin-wallet-block">
              <h3>待发放提现</h3>
              <div className="wallet-tx-list">
                {pendingWithdrawals.map((tx) => (
                  <article key={tx.id} className="wallet-tx">
                    <span className="wallet-tx-icon withdraw">
                      <Wallet size={18} />
                    </span>
                    <div className="wallet-tx-main">
                      <strong>提现 {formatYuan(-tx.amountCents)}</strong>
                      <small>{formatDate(tx.createdAt)}</small>
                    </div>
                    <button className="soft-button small" onClick={() => markPaid(tx.id)}>
                      <BadgeCheck size={16} />
                      标记已发放
                    </button>
                  </article>
                ))}
              </div>
            </div>
          ) : null}

          <div className="admin-wallet-block">
            <h3>手动调整</h3>
            <form className="admin-wallet-adjust" onSubmit={adjust}>
              <input
                type="number"
                step={0.1}
                value={adjustAmount}
                onChange={(event) => setAdjustAmount(event.target.value)}
                placeholder="金额（元，可为负）"
                required
              />
              <input
                value={adjustNote}
                onChange={(event) => setAdjustNote(event.target.value)}
                placeholder="原因，如：周末奖励"
                required
              />
              <button className="primary-button small" disabled={adjusting}>
                {adjusting ? <Loader2 className="spin" size={18} /> : <Plus size={18} />}
                调整
              </button>
            </form>
          </div>

          <div className="admin-wallet-block">
            <h3>钱包流水</h3>
            <div className="wallet-tx-list">
              {items.length ? (
                items.map((tx) => (
                  <article key={tx.id} className="wallet-tx">
                    <span className={`wallet-tx-icon ${tx.type}`}>{walletTxIcon(tx.type)}</span>
                    <div className="wallet-tx-main">
                      <strong>{walletTxLabel(tx.type)}</strong>
                      <small>
                        {walletTxCaption(tx)}
                        {walletTxCaption(tx) ? " · " : ""}
                        {formatDate(tx.createdAt)}
                      </small>
                    </div>
                    <b className={`wallet-amount ${tx.amountCents >= 0 ? "gain" : "loss"}`}>{formatYuanDelta(tx.amountCents)}</b>
                  </article>
                ))
              ) : (
                <p className="admin-empty">还没有钱包流水。</p>
              )}
            </div>
            <AdminPager total={total} offset={offset} onOffset={setOffset} />
          </div>
        </>
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
      const visibleTags = wordTags.length ? normalizeVisibleWordTags(tags, wordTags) : tags;
      const body = JSON.stringify({ name, definitions, examples, tags: visibleTags });
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
              <label key={tag.id} className={`admin-tag-option${tags.includes(tag.id) ? " checked" : ""}${adminWordTagTone(tag.id)}`}>
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

function AdminModal({
  title,
  onClose,
  children,
  className = ""
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className="admin-modal-backdrop" onClick={onClose}>
      <div className={`admin-modal ${className}`.trim()} onClick={(event) => event.stopPropagation()}>
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

function AdminPager({
  total,
  offset,
  onOffset,
  showPageJump = false
}: {
  total: number;
  offset: number;
  onOffset: (value: number) => void;
  showPageJump?: boolean;
}) {
  const pageCount = Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE));
  const page = Math.min(pageCount, Math.floor(offset / ADMIN_PAGE_SIZE) + 1);
  const [pageInput, setPageInput] = useState(String(page));
  const goToPage = (p: number) => onOffset((Math.min(Math.max(p, 1), pageCount) - 1) * ADMIN_PAGE_SIZE);
  const from = offset + 1;
  const to = Math.min(offset + ADMIN_PAGE_SIZE, total);

  useEffect(() => {
    setPageInput(String(page));
  }, [page]);

  function submitPageJump(event: React.FormEvent) {
    event.preventDefault();
    const nextPage = Number(pageInput);
    if (!Number.isFinite(nextPage)) {
      setPageInput(String(page));
      return;
    }
    goToPage(Math.trunc(nextPage));
  }

  if (total === 0) return null;

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
      {showPageJump && pageCount > 1 ? (
        <form className="admin-page-jump" onSubmit={submitPageJump}>
          <span>跳到</span>
          <input
            type="number"
            min={1}
            max={pageCount}
            step={1}
            value={pageInput}
            onChange={(event) => setPageInput(event.target.value)}
            aria-label="跳转页码"
          />
          <span>页</span>
          <button type="submit" className="admin-page-jump-button">
            <ArrowRight size={15} />
          </button>
        </form>
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

function currentShanghaiYear(): number {
  return Number(new Intl.DateTimeFormat("en", { timeZone: DISPLAY_TIME_ZONE, year: "numeric" }).format(new Date()));
}

function groupActivityMonths(days: ActivityCalendarDay[]): Array<{ key: string; label: string; days: ActivityCalendarDay[] }> {
  const groups = new Map<string, ActivityCalendarDay[]>();
  for (const day of days) {
    const key = day.date.slice(0, 7);
    groups.set(key, [...(groups.get(key) || []), day]);
  }
  return [...groups.entries()].map(([key, monthDays]) => ({
    key,
    label: `${Number(key.slice(5, 7))} 月`,
    days: monthDays
  }));
}

function selectActivityDate(data: ActivityCalendarData, current: string): string {
  if (current && data.days.some((day) => day.date === current)) return current;
  if (data.today.startsWith(String(data.year))) return data.today;
  for (let index = data.days.length - 1; index >= 0; index -= 1) {
    if (data.days[index].completed) return data.days[index].date;
  }
  return data.days[0]?.date || "";
}

function activityDayLevel(day: ActivityCalendarDay): "none" | "partial" | "full" {
  const summaries = [day.sentence, day.juniorWord, day.seniorWord];
  const doneCount = summaries.filter((summary) => summary.status !== "none").length;
  if (doneCount === summaries.length) return "full";
  if (doneCount > 0) return "partial";
  return "none";
}

function activityDayTitle(day: ActivityCalendarDay): string {
  const parts = [formatActivityDate(day.date), day.sentence.label, day.juniorWord.label, day.seniorWord.label];
  if (day.events.length) parts.push(day.events.map((event) => `${event.time || ""} ${event.label} ${event.detail}`.trim()).join("；"));
  return parts.join(" · ");
}

function firstActivityEventFilter(day: ActivityCalendarDay): ActivityEventFilter {
  if (day.sentence.status !== "none") return "sentence";
  if (day.juniorWord.status !== "none") return "juniorWord";
  if (day.seniorWord.status !== "none") return "seniorWord";
  return "sentence";
}

function activityEventsForFilter(events: ActivityCalendarEvent[], filter: ActivityEventFilter): ActivityCalendarEvent[] {
  return events.filter((event) => {
    if (filter === "sentence") return event.type === "sentence";
    if (filter === "juniorWord") return event.type === "word" && event.practiceKind !== "senior";
    return event.type === "word" && event.practiceKind === "senior";
  });
}

function activityFilterTitle(filter: ActivityEventFilter): string {
  if (filter === "sentence") return "中译英";
  if (filter === "juniorWord") return "中考词汇";
  return "高考词汇";
}

function activityEventClass(event: ActivityCalendarEvent): string {
  if (event.type === "sentence") return "activity-event sentence";
  return `activity-event word ${event.practiceKind === "senior" ? "senior-word" : "junior-word"}`;
}

function formatActivityDate(date: string): string {
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString("zh-CN", {
    timeZone: "UTC",
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long"
  });
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
  const audio = new Audio(apiUrl(`/api/word-audio/${encodeURIComponent(wordId)}?t=${Date.now()}`));
  await audio.play();
}

function wordProfileQuery(profile: WordPracticeProfile): string {
  return new URLSearchParams({ profile }).toString();
}

function formatDefinitionSummary(definitions: Array<{ partOfSpeech: string; meaning: string }>): string {
  const text = definitions
    .map((definition) => `${definition.partOfSpeech} ${definition.meaning}`.trim())
    .filter(Boolean)
    .join("；");
  return text || "暂无中文释义";
}

function summaryScoreClass(score: number | null): string {
  if (score === null) return "missing";
  if (score >= 90) return "great";
  if (score >= 70) return "ok";
  return "low";
}

// 把音标用斜杠包裹，如 /bɜːn/；若已自带斜杠则原样保留。
function formatPhonetics(phonetics: string[]): string {
  return phonetics
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => (/^\/.*\/$/.test(p) ? p : `/${p.replace(/^\/|\/$/g, "")}/`))
    .join("  ");
}

// 金额以分存储,整元显示 ¥3,非整元显示 ¥3.50；负数显示 ¥-3。
function formatYuan(cents: number): string {
  const abs = Math.abs(cents);
  const text = abs % 100 === 0 ? String(abs / 100) : (abs / 100).toFixed(2);
  return `¥${cents < 0 ? "-" : ""}${text}`;
}

// 流水动作金额使用动作符号：+¥3 / -¥3。
function formatYuanDelta(cents: number): string {
  if (cents >= 0) return `+${formatYuan(cents)}`;
  return `-${formatYuan(-cents)}`;
}

// 模拟银行卡的余额卡片：logo + 卡号 + 余额，鼠标移动时 3D 倾斜并带高光跟随。
function WalletCard({ balanceCents }: { balanceCents: number }) {
  const ref = useRef<HTMLDivElement>(null);

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width; // 0..1
    const py = (event.clientY - rect.top) / rect.height; // 0..1
    const rotateY = (px - 0.5) * 16; // 左右倾斜
    const rotateX = (0.5 - py) * 16; // 上下倾斜
    el.style.setProperty("--rx", `${rotateX.toFixed(2)}deg`);
    el.style.setProperty("--ry", `${rotateY.toFixed(2)}deg`);
    el.style.setProperty("--glare-x", `${(px * 100).toFixed(1)}%`);
    el.style.setProperty("--glare-y", `${(py * 100).toFixed(1)}%`);
  }

  function reset() {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty("--rx", "0deg");
    el.style.setProperty("--ry", "0deg");
    el.style.setProperty("--glare-x", "50%");
    el.style.setProperty("--glare-y", "0%");
  }

  return (
    <div className="wallet-card-scene">
      <div
        ref={ref}
        className={`wallet-balance-card ${balanceCents < 0 ? "negative" : ""}`}
        aria-label={`当前余额 ${formatYuan(balanceCents)}`}
        onPointerMove={handlePointerMove}
        onPointerLeave={reset}
      >
        <div className="wallet-card-glare" aria-hidden="true" />
        <div className="wallet-card-top">
          <span className="wallet-card-logo" aria-hidden="true">
            <BookOpen size={22} strokeWidth={2.4} />
          </span>
          <span className="wallet-card-brand">练习奖励卡</span>
        </div>
        <div className="wallet-card-balance">
          <span className="wallet-card-label">当前余额</span>
          <strong>{formatYuan(balanceCents)}</strong>
        </div>
        <div className="wallet-card-bottom" aria-hidden="true">
          <span className="wallet-card-number">**** **** **** 2026</span>
          <span className="wallet-card-holder">林沄</span>
        </div>
      </div>
    </div>
  );
}

const DISPLAY_TIME_ZONE = "Asia/Shanghai";
const SQLITE_TIMESTAMP_RE = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;

function parseServerDate(value: string): Date {
  const normalized = SQLITE_TIMESTAMP_RE.test(value) ? `${value.replace(" ", "T")}Z` : value;
  return new Date(normalized);
}

function formatDate(value: string): string {
  if (!value) return "";
  const date = parseServerDate(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN", {
    timeZone: DISPLAY_TIME_ZONE,
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

createRoot(document.getElementById("root")!).render(<App />);
