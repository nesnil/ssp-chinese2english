import { AiConfigError, chatCompletionsUrl } from "./grader.js";
import { errorMessage, logModelInteraction, modelHistoryRequest, trimHistoryText } from "./modelHistory.js";
import type { AiModelConfig, ModelInteractionContext } from "./types.js";

export type WalletIntentAction = "add" | "deduct" | "query" | "unknown";

export type WalletIntent = {
  action: WalletIntentAction;
  amountYuan: number | null;
  note: string | null;
};

// Siri 语音单次调整上限（比 adjustWallet 的 ¥1000 更紧，防止误听出大数）。
export const SIRI_ADJUST_MAX_YUAN = 100;
const NOTE_MAX_LENGTH = 100;

const UNKNOWN_INTENT: WalletIntent = { action: "unknown", amountYuan: null, note: null };

const SYSTEM_PROMPT = `你是一个家庭学习奖励钱包的语音指令解析器。孩子完成练习会得到零花钱奖励，家长通过语音管理这个钱包。
把家长说的中文口语解析成 JSON，只输出 JSON，不要输出其他内容：
{"action": "add" | "deduct" | "query" | "unknown", "amountYuan": 数字或 null, "note": 字符串或 null}

规则：
- 给钱包加钱、奖励、发钱 → action 为 "add"，amountYuan 为正数金额（单位元）。
- 扣钱、罚款、减钱 → action 为 "deduct"，amountYuan 为正数金额（单位元）。
- 询问余额、还有多少钱 → action 为 "query"，amountYuan 为 null。
- 与钱包无关、听不懂、或没有说清金额的加减操作 → action 为 "unknown"。
- note 是操作原因的简短概括（如"今天作业全对"），家长没说原因就是 null，不要编造。
- 金额只接受说出的数字，不要猜测；"五块""5元""5块钱"都是 5。

示例：
"给林沄加5元，因为今天作业全对" → {"action":"add","amountYuan":5,"note":"今天作业全对"}
"扣两块钱，上课讲话" → {"action":"deduct","amountYuan":2,"note":"上课讲话"}
"钱包里还有多少钱" → {"action":"query","amountYuan":null,"note":null}
"今天天气怎么样" → {"action":"unknown","amountYuan":null,"note":null}`;

// 把 LLM 返回的任意 JSON 收敛成合法的 WalletIntent，绝不猜测执行。
export function normalizeWalletIntent(input: unknown): WalletIntent {
  if (!input || typeof input !== "object") return UNKNOWN_INTENT;
  const raw = input as Record<string, unknown>;
  const action = raw.action;
  if (action === "query") return { action: "query", amountYuan: null, note: null };
  if (action !== "add" && action !== "deduct") return UNKNOWN_INTENT;

  const amountYuan = Number(raw.amountYuan);
  if (!Number.isFinite(amountYuan) || amountYuan <= 0) return UNKNOWN_INTENT;

  const note = typeof raw.note === "string" && raw.note.trim() ? raw.note.trim().slice(0, NOTE_MAX_LENGTH) : null;
  return { action, amountYuan, note };
}

// 校验并换算成带符号的分。金额不合规时抛出可直接朗读的中文错误。
export function intentToAdjustCents(intent: WalletIntent): number {
  if (intent.action !== "add" && intent.action !== "deduct") {
    throw new Error("没听懂，请再说一次，比如：加 5 元。");
  }
  const amountYuan = intent.amountYuan;
  if (amountYuan === null || !Number.isFinite(amountYuan) || amountYuan <= 0) {
    throw new Error("没听清金额，请再说一次，比如：加 5 元。");
  }
  if (amountYuan > SIRI_ADJUST_MAX_YUAN) {
    throw new Error(`单次最多操作 ${SIRI_ADJUST_MAX_YUAN} 元，已取消。`);
  }
  const cents = Math.round(amountYuan * 100);
  if (cents === 0) {
    throw new Error("金额太小，已取消。");
  }
  return intent.action === "add" ? cents : -cents;
}

export async function parseWalletCommand(
  config: AiModelConfig,
  text: string,
  history?: ModelInteractionContext
): Promise<WalletIntent> {
  if (!config.baseUrl || !config.apiKey || !config.model) {
    logModelInteraction(history, {
      status: "error",
      provider: "openai-compatible",
      model: config.model,
      request: { text },
      errorMessage: "AI 模型配置不完整。"
    });
    throw new AiConfigError("AI 模型配置不完整，请管理员先在后台配置 Base URL、API Key 和模型名称。");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
  const startedAt = Date.now();
  const requestBody = {
    model: config.model,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: text }
    ],
    temperature: 0,
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
    if (!content) return UNKNOWN_INTENT;
    const intent = normalizeWalletIntent(JSON.parse(content));
    responseHistory = {
      httpStatus: response.status,
      bodyText: trimHistoryText(bodyText),
      content: trimHistoryText(content),
      intent
    };
    return intent;
  } catch (error) {
    status = "error";
    failure = errorMessage(error, "Siri 语音指令解析失败。");
    console.error("parseWalletCommand failed:", error);
    return UNKNOWN_INTENT;
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
