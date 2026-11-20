// The assistant's answers, as the API sends them, and how the page shows
// them. Shared by the server action and the panel.

// The API's limits for a question
export const MIN_QUESTION = 3;
export const MAX_QUESTION = 500;

export interface Source {
  number: number;
  // "rules": Regelvakt's own rules; "page": a section of an official page
  kind: "rules" | "page";
  title: string;
  heading: string;
  url: string | null;
  excerpt: string;
  // The answer refers to it
  cited: boolean;
}

export interface AssistantAnswer {
  // "answer": written by the language model; "sources": the most relevant
  // sections only
  mode: "answer" | "sources";
  answer: string | null;
  sources: Source[];
  disclaimer: string;
  // With "sources", why: no model set up, the model's quota for the day
  // used up, or the model failed this time. Null with "answer".
  reason: "noModel" | "modelQuota" | "modelFailed" | null;
  // With "sources": the deadlines in Regelvakt's rules for what the
  // question is about. Empty with "answer".
  deadlines: { title: string; text: string }[];
}

export interface AssistantStatus {
  ready: boolean;
  knowledgeBase: { pages: number; sections: number; updatedAt: string | null };
  model: string | null;
  // The model is used on a free tier: the provider may use the questions,
  // and only a few are answered a day
  freeTier: boolean;
}

// What the page says when an answer holds the sources only
export function excerptsMessage(
  reason: AssistantAnswer["reason"],
): "excerptsQuota" | "excerptsFailed" | "excerptsOnly" {
  if (reason === "modelQuota") return "excerptsQuota";
  if (reason === "modelFailed") return "excerptsFailed";
  return "excerptsOnly";
}

// The page id of a source in one answer; answers on the same page each
// have their own prefix
export function sourceAnchor(prefix: string, number: number): string {
  return `${prefix}-source-${number}`;
}

// Turns the answer's source numbers, "[2]", into links to the sources
// under it. The numbers stay visible as they are.
export function linkCitations(text: string, prefix: string): string {
  return text.replace(
    /\[(\d+)\]/g,
    (_match, number: string) =>
      `[\\[${number}\\]](#${sourceAnchor(prefix, Number(number))})`,
  );
}
