import { logger } from "../../config/logger.js";
import {
  type ChatRequest,
  type LlmProvider,
  LlmQuotaError,
  LlmResponseError,
  LlmTimeoutError,
  LlmUnavailableError,
  requestTimeoutMs,
} from "./types.js";

const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

export interface GeminiConfig {
  apiKey: string;
  model: string;
  // For the whole answer, the tries again included
  timeoutMs: number;
  // How much the model thinks before it answers ("low", "medium", ...;
  // which levels a model takes depends on the model). Null leaves the
  // model's own default, which for newer models is often the highest.
  thinkingLevel: string | null;
  // How long to wait before each new try when Gemini is busy or down for
  // a moment; one entry per try. Tests set shorter ones.
  retryDelaysMs?: number[];
}

// Gemini's own answer to a busy model (503) is that the spikes are
// usually temporary: two more tries, a little apart
const DEFAULT_RETRY_DELAYS_MS = [2000, 5000];

// Errors that pass by themselves: Google's servers failing or busy
// (500-504), or no connection for a moment. Not 429, a quota that is
// used up, which another try a few seconds later does not change, and not
// other answers about the request itself.
const TEMPORARY_STATUSES = new Set([500, 502, 503, 504]);

class TemporaryError extends Error {
  constructor(readonly cause: Error) {
    super(cause.message);
  }
}

interface GeminiResponse {
  candidates?: {
    content?: { parts?: { text?: string; thought?: boolean }[] };
    finishReason?: string;
  }[];
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    thoughtsTokenCount?: number;
  };
  error?: { message?: string };
}

// Converts the messages into Gemini's format: a separate system
// instruction, and "model" instead of "assistant"
function toGeminiRequest(request: ChatRequest, thinkingLevel: string | null) {
  const system = request.messages
    .filter((message) => message.role === "system")
    .map((message) => message.content)
    .join("\n\n");

  return {
    ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
    contents: request.messages
      .filter((message) => message.role !== "system")
      .map((message) => ({
        role: message.role === "assistant" ? "model" : "user",
        parts: [{ text: message.content }],
      })),
    generationConfig: {
      temperature: 0.1,
      ...(request.json ? { responseMimeType: "application/json" } : {}),
      // Answers built from the sources need little reasoning; thinking
      // makes them slower and costs tokens
      ...(thinkingLevel ? { thinkingConfig: { thinkingLevel } } : {}),
    },
  };
}

// Talks to the Gemini API (Google AI Studio key) with plain fetch
export class GeminiProvider implements LlmProvider {
  readonly name: string;
  readonly timeoutMs: number;

  constructor(private readonly config: GeminiConfig) {
    this.name = `gemini:${config.model}`;
    this.timeoutMs = config.timeoutMs;
  }

  async chat(request: ChatRequest): Promise<string> {
    const body = JSON.stringify(
      toGeminiRequest(request, this.config.thinkingLevel),
    );
    const delays = this.config.retryDelaysMs ?? DEFAULT_RETRY_DELAYS_MS;
    const timeoutMs = requestTimeoutMs(request, this.config.timeoutMs);
    const deadline = Date.now() + timeoutMs;

    for (let attempt = 0; ; attempt++) {
      try {
        return await this.attempt(body, deadline, timeoutMs);
      } catch (error: unknown) {
        if (!(error instanceof TemporaryError)) throw error;
        const delay = delays[attempt];
        // No tries left, or no time left for another one after the wait
        if (delay === undefined || Date.now() + delay >= deadline) {
          throw error.cause;
        }
        logger.warn(
          {
            module: "gemini",
            model: this.config.model,
            attempt: attempt + 1,
            retryInMs: delay,
            err: error.cause,
          },
          "Gemini failed for a moment; trying again",
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  // One request, within the time left until the deadline
  private async attempt(
    body: string,
    deadline: number,
    timeoutMs: number,
  ): Promise<string> {
    const url = `${GEMINI_BASE_URL}/models/${encodeURIComponent(this.config.model)}:generateContent`;

    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": this.config.apiKey,
        },
        body,
        signal: AbortSignal.timeout(Math.max(deadline - Date.now(), 1)),
      });
    } catch (error: unknown) {
      if (error instanceof Error && error.name === "TimeoutError") {
        throw new LlmTimeoutError(
          `Gemini did not answer within ${Math.round(timeoutMs / 1000)} seconds`,
        );
      }
      throw new TemporaryError(
        new LlmUnavailableError("Gemini could not be reached"),
      );
    }

    const data = (await response.json().catch(() => ({}))) as GeminiResponse;

    if (!response.ok) {
      const message = `Gemini answered ${response.status}: ${data.error?.message ?? response.statusText}`;
      // 429: the requests per minute or per day are used up (20 a day for
      // a model on the free tier)
      if (response.status === 429) throw new LlmQuotaError(message);
      const error = new LlmResponseError(message);
      throw TEMPORARY_STATUSES.has(response.status)
        ? new TemporaryError(error)
        : error;
    }

    const candidate = data.candidates?.[0];
    const answer = (candidate?.content?.parts ?? [])
      // Thought summaries are not part of the answer
      .filter((part) => !part.thought)
      .map((part) => part.text ?? "")
      .join("")
      .trim();
    if (!answer) {
      // Why Gemini gave no answer: a stop for length or safety, or the
      // output spent on thinking
      logger.warn(
        {
          module: "gemini",
          model: this.config.model,
          finishReason: candidate?.finishReason,
          promptTokens: data.usageMetadata?.promptTokenCount,
          outputTokens: data.usageMetadata?.candidatesTokenCount,
          thoughtTokens: data.usageMetadata?.thoughtsTokenCount,
        },
        "Gemini returned an empty answer",
      );
    }
    return answer;
  }
}
