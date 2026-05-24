import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const resultRoot = path.join(repoRoot, "result");
const outputDir = path.resolve(__dirname, "../generated");
const outputPath = path.join(outputDir, "question-bank.json");

function extractPrompt(text) {
  const normalized = text.trim();
  const match = normalized.match(/^(.*?)[（(]([^（）()]+)[）)]\s*$/);
  if (!match) {
    return { chinese: normalized, prompt: "" };
  }
  return {
    chinese: match[1].trim(),
    prompt: match[2].trim()
  };
}

function parseDayMarkdown(source, season, day, filePath) {
  const lines = source.split(/\r?\n/);
  const questions = [];
  let current = null;

  for (const rawLine of lines) {
    const questionMatch = rawLine.match(/^(\d+)\.\s+(.+?)\s*$/);
    if (questionMatch) {
      if (current && !current.referenceAnswer) {
        throw new Error(`${filePath}: question ${current.questionNo} is missing an answer`);
      }
      const questionNo = Number(questionMatch[1]);
      const { chinese, prompt } = extractPrompt(questionMatch[2]);
      current = {
        id: `S${season}-D${day}-Q${questionNo}`,
        season,
        day,
        questionNo,
        chinese,
        prompt,
        sourceText: questionMatch[2].trim(),
        referenceAnswer: ""
      };
      questions.push(current);
      continue;
    }

    const answerMatch = rawLine.match(/^\s{2}-\s+(.+?)\s*$/);
    if (answerMatch && current) {
      current.referenceAnswer = answerMatch[1].trim();
    }
  }

  if (current && !current.referenceAnswer) {
    throw new Error(`${filePath}: question ${current.questionNo} is missing an answer`);
  }

  return questions;
}

async function build() {
  const seasons = [];
  const allQuestions = [];

  for (const season of [1, 2, 3, 4]) {
    const seasonDir = path.join(resultRoot, `s${season}_days`);
    const files = (await readdir(seasonDir))
      .filter((name) => /^Day\d+\.md$/.test(name))
      .sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]));

    const days = [];
    for (const file of files) {
      const day = Number(file.match(/\d+/)[0]);
      const filePath = path.join(seasonDir, file);
      const source = await readFile(filePath, "utf8");
      const questions = parseDayMarkdown(source, season, day, filePath);
      if (questions.length === 0) {
        throw new Error(`${filePath}: no questions found`);
      }
      days.push({ day, questionCount: questions.length });
      allQuestions.push(...questions);
    }

    seasons.push({
      season,
      title: `Season ${season}`,
      dayCount: days.length,
      questionCount: days.reduce((sum, day) => sum + day.questionCount, 0),
      days
    });
  }

  const bank = {
    version: 1,
    generatedAt: new Date().toISOString(),
    totalSeasons: seasons.length,
    totalDays: seasons.reduce((sum, season) => sum + season.dayCount, 0),
    totalQuestions: allQuestions.length,
    seasons,
    questions: allQuestions
  };

  await mkdir(outputDir, { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(bank, null, 2)}\n`, "utf8");
  console.log(`Wrote ${outputPath}`);
  console.log(`Questions: ${bank.totalQuestions}, days: ${bank.totalDays}`);
}

build().catch((error) => {
  console.error(error);
  process.exit(1);
});
