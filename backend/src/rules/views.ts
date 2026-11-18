// Shapes of rule definitions as they are sent to clients.
// Functions (askWhen) stay on the server.
import type { LocalizedText, QuestionDefinition } from "./types.js";

export interface QuestionView {
  id: string;
  type: "boolean" | "choice";
  text: LocalizedText;
  help: LocalizedText | null;
  options: { value: string; label: LocalizedText }[] | null;
}

export function toQuestionView(question: QuestionDefinition): QuestionView {
  return {
    id: question.id,
    type: question.type,
    text: question.text,
    help: question.help ?? null,
    options: question.type === "choice" ? question.options : null,
  };
}
