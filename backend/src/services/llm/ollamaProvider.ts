import { Ollama } from "ollama";
import {
  type ChatRequest,
  type LlmProvider,
  LlmResponseError,
  LlmTimeoutError,
  LlmUnavailableError,
} from "./types.js";

export const OLLAMA_CONTEXT_TOKENS = 8192;

export interface OllamaConfig {
  // http://localhost:11434 locally, https://ollama.com for Ollama Cloud
  host: string;
  model: string;
  // Only needed for Ollama Cloud
  apiKey: string | null;
  timeoutMs: number;
}

// Talks to a local Ollama server or to Ollama Cloud; the API is the same,
// the cloud only needs an API key.
export class OllamaProvider implements LlmProvider {
  readonly name: string;
  private readonly client: Ollama;

  constructor(private readonly config: OllamaConfig) {
    this.name = `ollama:${config.model}`;
    this.client = new Ollama({
      host: config.host,
      ...(config.apiKey
        ? { headers: { Authorization: `Bearer ${config.apiKey}` } }
        : {}),
      // Every request gets the time limit. The global fetch is looked up on
      // each call, so tests can replace it.
      fetch: (input, init) =>
        globalThis.fetch(input, {
          ...init,
          signal: AbortSignal.timeout(config.timeoutMs),
        }),
    });
  }

  async chat(request: ChatRequest): Promise<string> {
    try {
      const response = await this.client.chat({
        model: this.config.model,
        messages: request.messages,
        ...(request.json ? { format: "json" } : {}),
        stream: false,
        // Answers built on official sources: no creativity wanted.
        // Ollama's default context window (2048 or 4096 tokens, depending
        // on the version) cuts the sources off without telling; 8192 holds
        // the rules and five sections with room for the answer.
        options: { temperature: 0.1, num_ctx: OLLAMA_CONTEXT_TOKENS },
      });
      return response.message.content ?? "";
    } catch (error: unknown) {
      throw toLlmError(error, this.config);
    }
  }
}

function toLlmError(error: unknown, config: OllamaConfig): Error {
  if (error instanceof Error && error.name === "TimeoutError") {
    return new LlmTimeoutError(
      `Ollama did not answer within ${config.timeoutMs / 1000} seconds`,
    );
  }
  // The ollama library throws a ResponseError with the HTTP status
  if (
    error instanceof Error &&
    "status_code" in error &&
    typeof error.status_code === "number"
  ) {
    const hint =
      error.status_code === 404
        ? ` Is the model "${config.model}" pulled? Run: ollama pull ${config.model}`
        : "";
    return new LlmResponseError(
      `Ollama answered ${error.status_code}: ${error.message}.${hint}`,
    );
  }
  // fetch itself failed: nothing is listening at the host
  return new LlmUnavailableError(
    `Ollama could not be reached at ${config.host}. Is it running?`,
  );
}
