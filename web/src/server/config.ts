import path from "node:path";
import type { AppConfig } from "./types.js";

function numberFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
}

export function loadConfig(): AppConfig {
  return {
    port: numberFromEnv("PORT", 3000),
    databasePath: process.env.DATABASE_PATH || "/app/data/c2e.sqlite",
    appPassword: process.env.APP_PASSWORD,
    sessionSecret: process.env.SESSION_SECRET,
    deepseekBaseUrl: process.env.DEEPSEEK_BASE_URL,
    deepseekApiKey: process.env.DEEPSEEK_API_KEY,
    deepseekModel: process.env.DEEPSEEK_MODEL,
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
