import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  Flag,
  History,
  Heart,
  ListChecks,
  Loader2,
  LogOut,
  RotateCcw,
  Sparkles,
  Star,
  Trophy
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

function App() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [catalog, setCatalog] = useState<SeasonCatalog[]>([]);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [activeDay, setActiveDay] = useState<{ season: number; day: number } | null>(null);
  const [reviewMode, setReviewMode] = useState<"center" | "practice" | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const [catalogResponse, progressResponse] = await Promise.all([api("/api/catalog"), api("/api/progress")]);
      setCatalog(catalogResponse.seasons);
      setProgress(progressResponse);
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

  if (authenticated === false) {
    return <LoginScreen onLogin={refresh} />;
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
      onLogout={async () => {
        await api("/api/logout", { method: "POST" });
        setAuthenticated(false);
      }}
    >
      {error ? <div className="notice danger">{error}</div> : null}
      <Dashboard progress={progress} seasons={catalog} onStartDay={setActiveDay} onStartReview={() => setReviewMode("center")} />
    </Shell>
  );
}

function Shell({ children, onLogout }: { children: React.ReactNode; onLogout: () => void }) {
  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">
            <Sparkles size={22} />
          </span>
          <div>
            <p>中译英</p>
            <strong>每日闯关</strong>
          </div>
        </div>
        <button className="icon-button" onClick={onLogout} title="退出登录">
          <LogOut size={20} />
        </button>
      </header>
      {children}
    </main>
  );
}

function LoginScreen({ onLogin }: { onLogin: () => void }) {
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
      </section>
    </main>
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
        <div className="stat-metric">
          <strong>{metricValue}</strong>
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

function SeasonMap({ season, onStartDay }: { season: SeasonCatalog; onStartDay: (day: { season: number; day: number }) => void }) {
  return (
    <article className="season-map">
      <div className="season-header">
        <h3>S{season.season}</h3>
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
    Promise.all([
      api(`/api/days/${season}/${day}/questions`),
      api("/api/day-attempts/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ season, day })
      })
    ])
      .then(([questionData, attemptData]) => {
        setQuestions(questionData.questions);
        setAttemptId(attemptData.attemptId);
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
  nextLabel
}: {
  grade: Grade;
  onNext: () => void;
  isLast: boolean;
  nextLabel?: string;
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
        <button className="primary-button" onClick={onNext}>
          {nextLabel || (isLast ? "完成这一天" : "下一题")}
          <ArrowRight size={20} />
        </button>
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
