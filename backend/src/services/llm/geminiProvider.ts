import {
  type ChatRequest,
  type LlmProvider,
  LlmResponseError,
  LlmTimeoutError,
  LlmUnavailableError,
} from "./types.js";

const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

export interface GeminiConfig {
  apiKey: string;
  model: string;
  timeoutMs: number;
}

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
  error?: { message?: string };
}

// Converts the messages into Gemini's format: a separate system
// instruction, and "model" instead of "assistant"
function toGeminiRequest(request: ChatRequest) {
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
    },
  };
}

// Talks to the Gemini API (Google AI Studio key) with plain fetch
export class GeminiProvider implements LlmProvider {
  readonly name: string;

  constructor(private readonly config: GeminiConfig) {
    this.name = `gemini:${config.model}`;
  }

  async chat(request: ChatRequest): Promise<string> {
    const url = `${GEMINI_BASE_URL}/models/${encodeURIComponent(this.config.model)}:generateContent`;

    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": this.config.apiKey,
        },
        body: JSON.stringify(toGeminiRequest(request)),
        signal: AbortSignal.timeout(this.config.timeoutMs),
      });
    } catch (error: unknown) {
      if (error instanceof Error && error.name === "TimeoutError") {
        throw new LlmTimeoutError(
          `Gemini did not answer within ${this.config.timeoutMs / 1000} seconds`,
        );
      }
      throw new LlmUnavailableError("Gemini could not be reached");
    }

    const data = (await response.json().catch(() => ({}))) as GeminiResponse;

    if (!response.ok) {
      // 429: the free tier's requests per minute or per day are used up
      throw new LlmResponseError(
        `Gemini answered ${response.status}: ${data.error?.message ?? response.statusText}`,
      );
    }

    return (data.candidates?.[0]?.content?.parts ?? [])
      .map((part) => part.text ?? "")
      .join("")
      .trim();
  }
}
