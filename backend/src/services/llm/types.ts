// The app's own shapes for talking to a language model, independent of
// the provider. Each provider translates them to and from its own API.
// The same design as in Leverandørvakt, without tool calling, which the
// assistant here does not need.

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatRequest {
  messages: ChatMessage[];
  // Ask for a JSON object as the answer (supported by both providers)
  json?: boolean;
}

export interface LlmProvider {
  // Name of the provider and model, e.g. "ollama:qwen3"; shown in logs
  readonly name: string;
  // The model's answer as text
  chat(request: ChatRequest): Promise<string>;
}

// The model could not be reached at all (e.g. Ollama is not running)
export class LlmUnavailableError extends Error {}
// The model did not answer within the time limit
export class LlmTimeoutError extends Error {}
// The model answered with an error (e.g. unknown model, quota used up)
export class LlmResponseError extends Error {}
