import { GeminiProvider } from "./geminiProvider.js";
import { OllamaProvider } from "./ollamaProvider.js";
import type { LlmProvider } from "./types.js";

const DEFAULT_TIMEOUT_SECONDS = 60;

let override: LlmProvider | null | undefined;

// Creates the provider chosen in the environment, or null when no language
// model is set up; the assistant then answers with the most relevant
// official pages only. Read on every call, so tests can set their own.
//
// AI_PROVIDER=ollama   OLLAMA_HOST, OLLAMA_MODEL, OLLAMA_API_KEY (cloud only)
// AI_PROVIDER=gemini   GEMINI_API_KEY, GEMINI_MODEL
export function createLlmProvider(): LlmProvider | null {
  if (override !== undefined) return override;

  const env = process.env;
  const seconds = Number(env.AI_TIMEOUT_SECONDS);
  const timeoutMs =
    (Number.isFinite(seconds) && seconds > 0
      ? seconds
      : DEFAULT_TIMEOUT_SECONDS) * 1000;

  switch (env.AI_PROVIDER) {
    case "ollama":
      if (!env.OLLAMA_MODEL) return null;
      return new OllamaProvider({
        host: env.OLLAMA_HOST || "http://localhost:11434",
        model: env.OLLAMA_MODEL,
        apiKey: env.OLLAMA_API_KEY || null,
        timeoutMs,
      });
    case "gemini":
      if (!env.GEMINI_API_KEY || !env.GEMINI_MODEL) return null;
      return new GeminiProvider({
        apiKey: env.GEMINI_API_KEY,
        model: env.GEMINI_MODEL,
        timeoutMs,
      });
    default:
      return null;
  }
}

// For tests: use this provider (null: none). undefined puts back the
// environment's choice.
export function setLlmProvider(provider: LlmProvider | null | undefined): void {
  override = provider;
}
