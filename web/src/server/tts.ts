import { randomUUID } from "node:crypto";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { AppConfig, TtsSettings, WordEntry } from "./types.js";
import { generatedWordAudioPath } from "./wordBank.js";

type FetchLike = typeof fetch;

export class TtsConfigError extends Error {}

export async function testTtsConnection(settings: TtsSettings, fetchImpl: FetchLike = fetch): Promise<void> {
  await synthesizeSpeech(settings, "test", fetchImpl);
}

export async function generateWordAudio(
  config: AppConfig,
  settings: TtsSettings,
  word: Pick<WordEntry, "id" | "name">,
  fetchImpl: FetchLike = fetch
): Promise<{ relativePath: string; absolutePath: string }> {
  if (!settings.configured) throw new TtsConfigError("TTS 发音模型未配置。");
  const audio = await synthesizeSpeech(settings, word.name, fetchImpl);
  if (audio.byteLength === 0) throw new Error("TTS 返回了空音频。");

  const target = generatedWordAudioPath(config, word.id);
  await mkdir(path.dirname(target.absolutePath), { recursive: true });
  const tempPath = `${target.absolutePath}.${randomUUID()}.tmp`;
  try {
    await writeFile(tempPath, audio);
    await rename(tempPath, target.absolutePath);
  } catch (error) {
    await rm(tempPath, { force: true }).catch(() => {});
    throw error;
  }
  return target;
}

async function synthesizeSpeech(settings: TtsSettings, input: string, fetchImpl: FetchLike): Promise<Buffer> {
  return settings.provider === "volcengine"
    ? synthesizeVolcengine(settings, input, fetchImpl)
    : synthesizeOpenAiCompatible(settings, input, fetchImpl);
}

async function synthesizeOpenAiCompatible(settings: TtsSettings, input: string, fetchImpl: FetchLike): Promise<Buffer> {
  if (!settings.baseUrl || !settings.apiKey || !settings.model || !settings.voice) {
    throw new TtsConfigError("请完整配置 OpenAI-compatible TTS 的 Base URL、API Key、模型和 Voice。");
  }
  const response = await fetchWithTimeout(
    openAiSpeechUrl(settings.baseUrl),
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${settings.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: settings.model,
        voice: settings.voice,
        input,
        response_format: settings.format || "mp3"
      })
    },
    settings.timeoutMs,
    fetchImpl
  );
  if (!response.ok) throw new Error(`OpenAI-compatible TTS 请求失败：HTTP ${response.status} ${await safeErrorText(response)}`);
  return Buffer.from(await response.arrayBuffer());
}

async function synthesizeVolcengine(settings: TtsSettings, input: string, fetchImpl: FetchLike): Promise<Buffer> {
  if (!settings.baseUrl || !settings.accessToken || !settings.cluster || !settings.voiceType) {
    throw new TtsConfigError("请完整配置火山引擎 TTS 的 Base URL、API Key、Resource ID 和 Speaker。");
  }
  const response = await fetchWithTimeout(
    settings.baseUrl,
    {
      method: "POST",
      headers: {
        "X-Api-Key": settings.accessToken,
        "X-Api-Resource-Id": settings.cluster,
        "X-Api-Request-Id": randomUUID(),
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        req_params: {
          text: input,
          speaker: settings.voiceType,
          audio_params: {
            format: settings.encoding || settings.format || "mp3",
            sample_rate: 24000
          }
        }
      })
    },
    settings.timeoutMs,
    fetchImpl
  );
  if (!response.ok) throw new Error(`火山引擎 TTS 请求失败：HTTP ${response.status} ${await safeErrorText(response)}`);
  return decodeVolcengineAudio(await response.text());
}

function decodeVolcengineAudio(text: string): Buffer {
  const chunks: Buffer[] = [];
  const lines = text
    .trim()
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const payloads = lines.length > 0 ? lines : [text.trim()];

  for (const line of payloads) {
    const payload = JSON.parse(line) as { code?: number; message?: string; data?: string };
    if (payload.code !== undefined && payload.code !== 0 && payload.code !== 20000000) {
      throw new Error(`火山引擎 TTS 返回错误：${payload.message || `code ${payload.code}`}`);
    }
    if (payload.data) chunks.push(Buffer.from(payload.data, "base64"));
  }

  if (chunks.length === 0) throw new Error("火山引擎 TTS 未返回音频 data。");
  return Buffer.concat(chunks);
}

function openAiSpeechUrl(baseUrl: string): string {
  const trimmed = baseUrl.replace(/\/+$/, "");
  if (trimmed.endsWith("/v1/audio/speech")) return trimmed;
  if (trimmed.endsWith("/v1")) return `${trimmed}/audio/speech`;
  return `${trimmed}/v1/audio/speech`;
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  fetchImpl: FetchLike
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw new Error(`TTS 请求超时（${timeoutMs}ms）。`);
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function safeErrorText(response: Response): Promise<string> {
  try {
    return (await response.text()).slice(0, 300);
  } catch {
    return "";
  }
}
