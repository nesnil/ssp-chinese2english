import { readFileSync } from "node:fs";
import path from "node:path";
import type { Question, QuestionBank } from "./types.js";

function resolveBankPath(): string {
  if (process.env.QUESTION_BANK_PATH) return process.env.QUESTION_BANK_PATH;
  const builtPath = path.resolve(process.cwd(), "generated/question-bank.json");
  return builtPath;
}

const bankPath = resolveBankPath();
const bank = JSON.parse(readFileSync(bankPath, "utf8")) as QuestionBank;

const questionsById = new Map(bank.questions.map((question) => [question.id, question]));
const questionsByDay = new Map<string, Question[]>();

for (const question of bank.questions) {
  const key = `${question.season}:${question.day}`;
  const list = questionsByDay.get(key) || [];
  list.push(question);
  questionsByDay.set(key, list);
}

for (const list of questionsByDay.values()) {
  list.sort((a, b) => a.questionNo - b.questionNo);
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
