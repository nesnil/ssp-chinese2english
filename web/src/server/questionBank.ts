import { readFileSync } from "node:fs";
import path from "node:path";
import type { AppDatabase, QuestionRow } from "./db.js";
import type { Question, QuestionBank } from "./types.js";

let database: AppDatabase | null = null;
let bank: QuestionBank = emptyBank();
let questionsById = new Map<string, Question>();
let questionsByDay = new Map<string, Question[]>();

export function loadSeedQuestionBank(): QuestionBank {
  const bankPath = process.env.QUESTION_BANK_PATH || path.resolve(process.cwd(), "generated/question-bank.json");
  return JSON.parse(readFileSync(bankPath, "utf8")) as QuestionBank;
}

export function initQuestionBank(db: AppDatabase): void {
  database = db;
  reloadQuestionBank();
}

export function reloadQuestionBank(): void {
  if (!database) throw new Error("Question bank not initialized.");
  const rows = database.allQuestionRows();
  rebuild(rows.map(rowToQuestion));
}

export function getBank(): QuestionBank {
  return bank;
}

export function getQuestion(id: string): Question | undefined {
  return questionsById.get(id);
}

export function getDayQuestions(season: number, day: number): Question[] {
  return questionsByDay.get(`${season}:${day}`) || [];
}

export function toPublicQuestion(question: Question) {
  return {
    id: question.id,
    season: question.season,
    day: question.day,
    questionNo: question.questionNo,
    chinese: question.chinese,
    prompt: question.prompt
  };
}

function rebuild(questions: Question[]): void {
  questionsById = new Map(questions.map((question) => [question.id, question]));
  questionsByDay = new Map<string, Question[]>();

  for (const question of questions) {
    const key = `${question.season}:${question.day}`;
    const list = questionsByDay.get(key) || [];
    list.push(question);
    questionsByDay.set(key, list);
  }
  for (const list of questionsByDay.values()) {
    list.sort((a, b) => a.questionNo - b.questionNo);
  }

  bank = buildSummary(questions);
}

function buildSummary(questions: Question[]): QuestionBank {
  const seasonsMap = new Map<number, Map<number, number>>();
  for (const question of questions) {
    const days = seasonsMap.get(question.season) || new Map<number, number>();
    days.set(question.day, (days.get(question.day) || 0) + 1);
    seasonsMap.set(question.season, days);
  }

  const seasons = [...seasonsMap.entries()]
    .sort(([a], [b]) => a - b)
    .map(([season, days]) => {
      const daySummaries = [...days.entries()]
        .sort(([a], [b]) => a - b)
        .map(([day, questionCount]) => ({ day, questionCount }));
      return {
        season,
        title: `Season ${season}`,
        dayCount: daySummaries.length,
        questionCount: daySummaries.reduce((sum, day) => sum + day.questionCount, 0),
        days: daySummaries
      };
    });

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    totalSeasons: seasons.length,
    totalDays: seasons.reduce((sum, season) => sum + season.dayCount, 0),
    totalQuestions: questions.length,
    seasons,
    questions
  };
}

function rowToQuestion(row: QuestionRow): Question {
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

function emptyBank(): QuestionBank {
  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    totalSeasons: 0,
    totalDays: 0,
    totalQuestions: 0,
    seasons: [],
    questions: []
  };
}
