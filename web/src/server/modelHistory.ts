import type { ModelInteractionContext, ModelInteractionLogEntry, ModelInteractionStatus } from "./types.js";

const HISTORY_TEXT_LIMIT = 12000;

export function trimHistoryText(value: string, limit = HISTORY_TEXT_LIMIT): string {
  if (value.length <= limit) return value;
  return `${value.slice(0, limit)}\n...[truncated ${value.length - limit} chars]`;
}

export function modelHistoryRequest(url: string, body: unknown): { url: string; body: unknown } {
  return { url, body };
}

export function logModelInteraction(
  context: ModelInteractionContext | undefined,
  entry: Omit<ModelInteractionLogEntry, "kind" | "operation" | "refType" | "refId"> & { status: ModelInteractionStatus }
): void {
  if (!context?.log) return;
  try {
    context.log({
      kind: context.kind,
      operation: context.operation,
      refType: context.refType ?? null,
      refId: context.refId ?? null,
      ...entry
    });
  } catch (error) {
    console.error("record model interaction failed:", error);
  }
}

export function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}
