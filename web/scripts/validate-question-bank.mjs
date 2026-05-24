import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const bankPath = path.resolve(__dirname, "../generated/question-bank.json");
const bank = JSON.parse(await readFile(bankPath, "utf8"));

const expectedDays = new Map([
  [1, 68],
  [2, 67],
  [3, 50],
  [4, 39]
]);

const ids = new Set();
for (const question of bank.questions) {
  if (ids.has(question.id)) throw new Error(`Duplicate id: ${question.id}`);
  ids.add(question.id);
  if (!question.chinese) throw new Error(`${question.id}: missing chinese text`);
  if (!question.referenceAnswer) throw new Error(`${question.id}: missing answer`);
  if (!Number.isInteger(question.questionNo)) throw new Error(`${question.id}: bad question number`);
}

for (const season of bank.seasons) {
  if (season.dayCount !== expectedDays.get(season.season)) {
    throw new Error(`Season ${season.season}: expected ${expectedDays.get(season.season)} days, got ${season.dayCount}`);
  }
}

if (bank.totalDays !== 224) throw new Error(`Expected 224 days, got ${bank.totalDays}`);
if (bank.totalQuestions !== 1115) throw new Error(`Expected 1115 questions, got ${bank.totalQuestions}`);

console.log(`Question bank OK: ${bank.totalQuestions} questions across ${bank.totalDays} days.`);
