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
}

export interface AssistantStatus {
  ready: boolean;
  knowledgeBase: { pages: number; sections: number; updatedAt: string | null };
  model: string | null;
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
