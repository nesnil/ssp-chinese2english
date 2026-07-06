import { errorMessage, logModelInteraction, modelHistoryRequest, trimHistoryText } from "./modelHistory.js";
import type { AiModelConfig, GradeResult, ModelInteractionContext, Question, WordEntry } from "./types.js";

type ChatMessage = {
  role: "system" | "user";
  content: string;
};

export class AiConfigError extends Error {}

type GradeRuntimeConfig = AiModelConfig & {
  reviewScoreThreshold: number;
};

export function chatCompletionsUrl(baseUrl: string): string {
  const trimmed = baseUrl.replace(/\/+$/, "");
  if (trimmed.endsWith("/chat/completions")) return trimmed;
  return `${trimmed}/chat/completions`;
}

export async function gradeAnswer(
  config: GradeRuntimeConfig,
  question: Question,
  answer: string,
  history?: ModelInteractionContext
): Promise<GradeResult> {
  if (!config.baseUrl || !config.apiKey || !config.model) {
    logModelInteraction(history, {
      status: "error",
      provider: "openai-compatible",
      model: config.model,
      request: null,
      errorMessage: "AI 模型配置不完整。"
    });
    throw new AiConfigError("AI 模型配置不完整，请管理员先在后台配置 Base URL、API Key 和模型名称。");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
  const startedAt = Date.now();

  const messages: ChatMessage[] = [
    {
      role: "system",
      content:
        "你是一位鼓励型初中英语中译英老师。请严格输出 JSON，不要 Markdown。分数要根据含义、提示词使用、语法、表达自然度综合判断。没有满分时，先鼓励，再指出最关键的问题。满分时，不要指出问题，不要给修改建议；encouragement 写一句准确的满分表扬，suggestion 写一句有趣、儿童友好、每次尽量不一样的满分彩蛋鼓励。"
    },
    {
      role: "user",
      content: JSON.stringify({
        task: "批改中译英练习",
        chinese: question.chinese,
        promptWord: question.prompt,
        referenceAnswer: question.referenceAnswer,
        studentAnswer: answer,
        outputSchema: {
          score: "0-100 integer",
          level: "优秀/不错/继续加油/需要重练",
          encouragement: "一句给孩子的鼓励",
          issues: ["最多三条中文问题，简短具体"],
          suggestion: "非满分时是一条最值得马上修改的建议；满分时是一句有趣的满分彩蛋鼓励，不能要求修改",
          improvedAnswer: "在学生答案基础上改出的自然英文",
          needsReview: "boolean，低于80分或关键结构错误为true"
        }
      })
    }
  ];
  const requestBody = {
    model: config.model,
    messages,
    temperature: 0.35,
    response_format: { type: "json_object" }
  };
  let status: "success" | "error" = "success";
  let responseHistory: unknown;
  let failure: string | null = null;

  try {
    const url = chatCompletionsUrl(config.baseUrl);
    const response = await fetch(url, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`
      },
      body: JSON.stringify(requestBody)
    });

    const bodyText = await response.text();
    responseHistory = { httpStatus: response.status, bodyText: trimHistoryText(bodyText) };
    if (!response.ok) {
      throw new Error(`DeepSeek HTTP ${response.status}: ${bodyText.slice(0, 400)}`);
    }

    const body = JSON.parse(bodyText) as { choices?: Array<{ message?: { content?: string } }> };
    const content = body.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("DeepSeek response did not include message content.");
    }

    responseHistory = { httpStatus: response.status, bodyText: trimHistoryText(bodyText), content: trimHistoryText(content) };
    return normalizeGrade(JSON.parse(content), question.referenceAnswer, content, config.reviewScoreThreshold);
  } catch (error) {
    status = "error";
    if (error instanceof SyntaxError) {
      failure = "AI 返回内容不是有效 JSON。";
      return fallbackGrade(question.referenceAnswer, "AI 返回内容不是有效 JSON。");
    }
    if (error instanceof Error && error.name === "AbortError") {
      failure = "AI 批改超时，请稍后重试。";
      return fallbackGrade(question.referenceAnswer, "AI 批改超时，请稍后重试。");
    }
    failure = errorMessage(error, "AI 批改失败。");
    return fallbackGrade(question.referenceAnswer, failure);
  } finally {
    clearTimeout(timeout);
    logModelInteraction(history, {
      status,
      provider: "openai-compatible",
      model: config.model,
      request: modelHistoryRequest(chatCompletionsUrl(config.baseUrl), requestBody),
      response: responseHistory,
      errorMessage: failure,
      durationMs: Date.now() - startedAt
    });
  }
}

export async function testAiModelConnection(config: AiModelConfig, history?: ModelInteractionContext): Promise<void> {
  if (!config.baseUrl || !config.apiKey || !config.model) {
    logModelInteraction(history, {
      status: "error",
      provider: "openai-compatible",
      model: config.model,
      request: null,
      errorMessage: "AI 模型配置不完整。"
    });
    throw new AiConfigError("AI 模型配置不完整，请填写 Base URL、API Key 和模型名称。");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
  const startedAt = Date.now();
  const requestBody = {
    model: config.model,
    messages: [
      {
        role: "user",
        content: "Reply with the single word OK."
      }
    ],
    temperature: 0,
    max_tokens: 256
  };
  let status: "success" | "error" = "success";
  let responseHistory: unknown;
  let failure: string | null = null;

  try {
    const url = chatCompletionsUrl(config.baseUrl);
    const response = await fetch(url, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`
      },
      body: JSON.stringify(requestBody)
    });

    const bodyText = await response.text();
    responseHistory = { httpStatus: response.status, bodyText: trimHistoryText(bodyText) };
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${bodyText.slice(0, 240)}`);
    }

    // 连接测试只验证「能连通 + 鉴权通过 + 模型名有效」：HTTP 200 且返回里有 choices 即视为成功，
    // 不强求 message content（部分模型/网关在被 max_tokens 截断或只返回 reasoning 时 content 为空，
    // 但这并不代表连接不可用——真实批改时不设这种小 max_tokens 限制）。
    let body: { choices?: unknown[]; error?: { message?: string } };
    try {
      body = JSON.parse(bodyText);
    } catch {
      throw new Error("模型返回的不是有效 JSON，请确认 Base URL 是否指向 OpenAI 兼容的接口。");
    }
    if (body.error) {
      throw new Error(`模型返回错误：${body.error.message || JSON.stringify(body.error).slice(0, 200)}`);
    }
    if (!Array.isArray(body.choices)) {
      throw new Error("模型响应缺少 choices 字段，可能不是 OpenAI 兼容接口。");
    }
  } catch (error) {
    status = "error";
    if (error instanceof AiConfigError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      failure = "连接测试超时，请检查 Base URL、模型名称或网络状态。";
      throw new Error("连接测试超时，请检查 Base URL、模型名称或网络状态。");
    }
    failure = errorMessage(error, "模型连接测试失败。");
    throw error;
  } finally {
    clearTimeout(timeout);
    logModelInteraction(history, {
      status,
      provider: "openai-compatible",
      model: config.model,
      request: modelHistoryRequest(chatCompletionsUrl(config.baseUrl), requestBody),
      response: responseHistory,
      errorMessage: failure,
      durationMs: Date.now() - startedAt
    });
  }
}

export async function gradeWordRecall(
  config: GradeRuntimeConfig,
  word: WordEntry,
  input: { wordAnswer: string; meaningAnswers: Record<string, string> },
  history?: ModelInteractionContext
): Promise<GradeResult> {
  const referenceAnswer = wordReferenceAnswer(word);
  return gradeWithAi(
    config,
    [
      {
        role: "system",
        content:
          "你是一位鼓励型初中英语词汇老师。请严格输出 JSON，不要 Markdown。批改单词听写和中文释义默写：英文拼写要严格，中文释义允许近义词、同义表达和部分核心意思，不要求逐字完全一致。多词性单词要分别看对应词性的中文。没有满分时，先鼓励，再指出最关键的问题。"
      },
      {
        role: "user",
        content: JSON.stringify({
          task: "批改单词和中文释义默写",
          word: word.name,
          definitions: word.definitions,
          studentWord: input.wordAnswer,
          studentMeaningsByPartOfSpeech: input.meaningAnswers,
          outputSchema: gradeOutputSchema()
        })
      }
    ],
    referenceAnswer,
    config.reviewScoreThreshold,
    "重点比较单词拼写、词性和中文核心意思。",
    history
  );
}

export async function gradeExampleRecall(
  config: GradeRuntimeConfig,
  word: WordEntry,
  answers: string[],
  history?: ModelInteractionContext
): Promise<GradeResult> {
  const examples = word.examples.length ? word.examples : [{ english: "", chinese: "" }];
  // 把每句的中文、参考英文、学生答案配对，让 AI 一次综合批改、给一个总分。
  const items = examples.map((example, index) => ({
    no: index + 1,
    chineseExample: example.chinese,
    referenceAnswer: example.english,
    studentAnswer: (answers[index] || "").trim()
  }));
  const referenceAnswer = examples.map((example) => example.english).filter(Boolean).join(" / ");

  return gradeWithAi(
    config,
    [
      {
        role: "system",
        content:
          "你是一位鼓励型初中英语例句默写老师。请严格输出 JSON，不要 Markdown。这位同学一次默写了这个单词的多句例句，请综合所有例句给一个总分（0-100），允许轻微大小写和标点差异，重点看每句的核心意思、关键词、语法结构、时态和完整度。只有一句时正常批改；有多句时：issues 每条以“第N句：”开头分别指出问题，suggestion 也按句给建议，没问题的句子无需提及。没有满分时，先鼓励，再指出最关键的问题。"
      },
      {
        role: "user",
        content: JSON.stringify({
          task: "综合批改一个单词的多句例句默写",
          word: word.name,
          sentences: items,
          outputSchema: gradeOutputSchema()
        })
      }
    ],
    referenceAnswer,
    config.reviewScoreThreshold,
    "重点比较每句的主干、关键词、语法和完整度。",
    history
  );
}

async function gradeWithAi(
  config: GradeRuntimeConfig,
  messages: ChatMessage[],
  referenceAnswer: string,
  threshold: number,
  fallbackSuggestion: string,
  history?: ModelInteractionContext
): Promise<GradeResult> {
  if (!config.baseUrl || !config.apiKey || !config.model) {
    logModelInteraction(history, {
      status: "error",
      provider: "openai-compatible",
      model: config.model,
      request: null,
      errorMessage: "AI 模型配置不完整。"
    });
    throw new AiConfigError("AI 模型配置不完整，请管理员先在后台配置 Base URL、API Key 和模型名称。");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
  const startedAt = Date.now();
  const requestBody = {
    model: config.model,
    messages,
    temperature: 0.25,
    response_format: { type: "json_object" }
  };
  let status: "success" | "error" = "success";
  let responseHistory: unknown;
  let failure: string | null = null;

  try {
    const url = chatCompletionsUrl(config.baseUrl);
    const response = await fetch(url, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`
      },
      body: JSON.stringify(requestBody)
    });

    const bodyText = await response.text();
    responseHistory = { httpStatus: response.status, bodyText: trimHistoryText(bodyText) };
    if (!response.ok) {
      throw new Error(`DeepSeek HTTP ${response.status}: ${bodyText.slice(0, 400)}`);
    }

    const body = JSON.parse(bodyText) as { choices?: Array<{ message?: { content?: string } }> };
    const content = body.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("DeepSeek response did not include message content.");
    }

    responseHistory = { httpStatus: response.status, bodyText: trimHistoryText(bodyText), content: trimHistoryText(content) };
    return normalizeGrade(JSON.parse(content), referenceAnswer, content, threshold);
  } catch (error) {
    status = "error";
    if (error instanceof SyntaxError) {
      failure = "AI 返回内容不是有效 JSON。";
      return fallbackGrade(referenceAnswer, "AI 返回内容不是有效 JSON。", fallbackSuggestion);
    }
    if (error instanceof Error && error.name === "AbortError") {
      failure = "AI 批改超时，请稍后重试。";
      return fallbackGrade(referenceAnswer, "AI 批改超时，请稍后重试。", fallbackSuggestion);
    }
    failure = errorMessage(error, "AI 批改失败。");
    return fallbackGrade(referenceAnswer, failure, fallbackSuggestion);
  } finally {
    clearTimeout(timeout);
    logModelInteraction(history, {
      status,
      provider: "openai-compatible",
      model: config.model,
      request: modelHistoryRequest(chatCompletionsUrl(config.baseUrl), requestBody),
      response: responseHistory,
      errorMessage: failure,
      durationMs: Date.now() - startedAt
    });
  }
}

export function normalizeGrade(input: Record<string, unknown>, referenceAnswer: string, rawAi: string, threshold: number): GradeResult {
  const score = clampScore(Number(input.score));
  const issues = Array.isArray(input.issues)
    ? input.issues.map((issue) => String(issue)).filter(Boolean).slice(0, 3)
    : [];

  if (score === 100) {
    const encouragement = perfectPraiseText(
      input.encouragement,
      "满分！这句表达准确自然，提示词也用到位了。"
    );
    const suggestion = perfectPraiseText(input.suggestion, randomPerfectPraise(encouragement), encouragement);

    return {
      score,
      level: "满分",
      encouragement,
      issues: [],
      suggestion,
      improvedAnswer: referenceAnswer,
      referenceAnswer,
      needsReview: false,
      rawAi
    };
  }

  return {
    score,
    level: stringValue(input.level, score >= 90 ? "优秀" : score >= 80 ? "不错" : "继续加油"),
    encouragement: stringValue(input.encouragement, "你已经完成了这道题，继续保持。"),
    issues,
    suggestion: stringValue(input.suggestion, "对照参考答案，重点检查提示词和句子结构。"),
    improvedAnswer: stringValue(input.improvedAnswer, referenceAnswer),
    referenceAnswer,
    needsReview: typeof input.needsReview === "boolean" ? input.needsReview : score < threshold,
    rawAi
  };
}

function fallbackGrade(referenceAnswer: string, summary: string, suggestion = "重点比较句子主干、提示词和时态。"): GradeResult {
  return {
    score: 0,
    level: "待批改",
    encouragement: "你的答案已经提交成功，但 AI 批改暂时没有完成。",
    issues: ["请稍后再试，或先对照参考答案自查。"],
    suggestion,
    improvedAnswer: referenceAnswer,
    referenceAnswer,
    needsReview: true,
    errorSummary: summary
  };
}

function gradeOutputSchema() {
  return {
    score: "0-100 integer",
    level: "优秀/不错/继续加油/需要重练",
    encouragement: "一句给孩子的鼓励",
    issues: ["最多三条中文问题，简短具体"],
    suggestion: "非满分时是一条最值得马上修改的建议；满分时是一句有趣、儿童友好的满分彩蛋鼓励，不能要求修改",
    improvedAnswer: "在学生答案基础上改出的自然英文，或整理后的正确答案",
    needsReview: "boolean，低于80分或关键错误为true"
  };
}

function wordReferenceAnswer(word: WordEntry): string {
  const definitions = word.definitions
    .map((definition) => `${definition.partOfSpeech || "释义"} ${definition.meaning}`)
    .join("；");
  return `${word.name}：${definitions}`;
}

function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function stringValue(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function perfectPraiseText(value: unknown, fallback: string, avoid = ""): string {
  if (typeof value !== "string") return fallback;
  const text = value.trim();
  if (!text || text === avoid || hasCorrectiveTone(text)) return fallback;
  return text;
}

function hasCorrectiveTone(text: string): boolean {
  return /建议|改成|但是|不过|问题|错误|需要|检查|对照|参考答案|不够|再|更好|完全正确|保持这样的表达节奏/.test(text);
}

function randomPerfectPraise(avoid = ""): string {
  const options = [
    "这句像小火箭一样稳稳发射，意思、语法和提示词都到位了。",
    "满分星星已点亮，这个英文句子读起来又准又顺。",
    "这次翻译很漂亮，像把中文句子变成了一块整齐的小积木。",
    "答得很闪亮，提示词用得准，句子也站得很稳。",
    "这一题已经被你轻松拿下，英文表达清楚又自然。",
    "满分徽章送上，这句英文没有迷路，直接走到了正确答案门口。",
    "这句写得很有英语味，干净、准确、读起来很舒服。",
    "漂亮过关！这句话像排好队的小音符，读起来很顺。"
  ];
  const candidates = options.filter((option) => option !== avoid);
  return candidates[Math.floor(Math.random() * candidates.length)] || options[0];
}
