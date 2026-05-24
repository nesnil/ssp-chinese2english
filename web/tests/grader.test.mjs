import assert from "node:assert/strict";
import test from "node:test";

import { normalizeGrade } from "../dist/server/grader.js";

test("perfect score feedback is praise-focused and not corrective", () => {
  const grade = normalizeGrade(
    {
      score: 100,
      level: "优秀",
      encouragement: "不错，但是还可以更好。",
      issues: ["应改成参考答案的表达"],
      suggestion: "建议改成另一个句子。",
      improvedAnswer: "A different sentence.",
      needsReview: true
    },
    "The reference answer.",
    "{}",
    80
  );

  assert.equal(grade.score, 100);
  assert.equal(grade.level, "满分");
  assert.equal(grade.needsReview, false);
  assert.deepEqual(grade.issues, []);
  assert.match(grade.encouragement, /满分/);
  assert.doesNotMatch(grade.suggestion, /改成/);
});

test("perfect score keeps safe AI praise for the fun note", () => {
  const grade = normalizeGrade(
    {
      score: 100,
      level: "优秀",
      encouragement: "满分！这句像小火箭一样稳稳发射。",
      issues: [],
      suggestion: "满分星星已点亮，英文句子读起来又准又顺。",
      improvedAnswer: "The reference answer.",
      needsReview: false
    },
    "The reference answer.",
    "{}",
    80
  );

  assert.equal(grade.encouragement, "满分！这句像小火箭一样稳稳发射。");
  assert.equal(grade.suggestion, "满分星星已点亮，英文句子读起来又准又顺。");
});

test("perfect score replaces the old generic perfect suggestion", () => {
  const grade = normalizeGrade(
    {
      score: 100,
      encouragement: "满分！表达准确自然。",
      suggestion: "完全正确，保持这样的表达节奏。"
    },
    "The reference answer.",
    "{}",
    80
  );

  assert.notEqual(grade.suggestion, "完全正确，保持这样的表达节奏。");
});
