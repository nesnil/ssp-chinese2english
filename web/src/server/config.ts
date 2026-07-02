import path from "node:path";
import type { AppConfig } from "./types.js";

function numberFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
}

export function loadConfig(): AppConfig {
  const databasePath = process.env.DATABASE_PATH || "/app/data/c2e.sqlite";
  return {
    port: numberFromEnv("PORT", 3000),
    databasePath,
    wordAudioRoot: process.env.WORD_AUDIO_ROOT,
    appPassword: process.env.APP_PASSWORD,
    adminPassword: process.env.ADMIN_PASSWORD,
    sessionSecret: process.env.SESSION_SECRET,
    siriApiToken: process.env.SIRI_API_TOKEN,
    deepseekBaseUrl: process.env.DEEPSEEK_BASE_URL,
    deepseekApiKey: process.env.DEEPSEEK_API_KEY,
    deepseekModel: process.env.DEEPSEEK_MODEL,
    ttsProvider: process.env.TTS_PROVIDER,
    ttsBaseUrl: process.env.TTS_BASE_URL,
    ttsApiKey: process.env.TTS_API_KEY,
    ttsModel: process.env.TTS_MODEL,
    ttsVoice: process.env.TTS_VOICE,
    ttsFormat: process.env.TTS_FORMAT,
    ttsAppId: process.env.TTS_APP_ID,
    ttsAccessToken: process.env.TTS_ACCESS_TOKEN,
    ttsCluster: process.env.TTS_CLUSTER,
    ttsVoiceType: process.env.TTS_VOICE_TYPE,
    ttsEncoding: process.env.TTS_ENCODING,
    ttsTimeoutMs: numberFromEnv("TTS_TIMEOUT_MS", 30000),
    wordAudioGeneratedDir: process.env.WORD_AUDIO_GENERATED_DIR || path.resolve(path.dirname(databasePath), "word-audio/generated"),
    aiTimeoutMs: numberFromEnv("AI_TIMEOUT_MS", 30000),
    reviewScoreThreshold: numberFromEnv("REVIEW_SCORE_THRESHOLD", 80),
    nodeEnv: process.env.NODE_ENV || "development"
  };
}

export function isProduction(config: AppConfig): boolean {
  return config.nodeEnv === "production";
}

export function publicDir(): string {
  return path.resolve(process.cwd(), "dist/public");
}
