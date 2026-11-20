import type { Answers } from "./types";

// The answers in a submitted questions form. Each question is a group of
// radio buttons named after its id, with the values "true" and "false" or
// the question's options. `questionIds` are the questions that were shown.
export function answersFromForm(
  formData: FormData,
  questionIds: string[],
): { answers: Answers; missing: string[] } {
  const answers: Answers = {};
  const missing: string[] = [];
  for (const id of questionIds) {
    const value = formData.get(id);
    if (typeof value !== "string" || value === "") {
      missing.push(id);
    } else if (value === "true" || value === "false") {
      answers[id] = value === "true";
    } else {
      answers[id] = value;
    }
  }
  return { answers, missing };
}
