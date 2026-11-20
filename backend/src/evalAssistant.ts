// Measures the assistant's search: for each question in
// knowledge/evalQuestions.ts, is a right page among the first five
// sources? Run after `npm run knowledge`:
//   npm run eval:assistant
// With a language model set up (AI_PROVIDER), its search terms are used,
// as in the real assistant; without one, the question itself is searched.
import "reflect-metadata";
import "dotenv/config";
import { sequelize } from "./config/database.js";
import { EVAL_QUESTIONS } from "./knowledge/evalQuestions.js";
import { search } from "./knowledge/search.js";
import {
  searchTerms,
  searchTermsEnabled,
} from "./services/assistantService.js";
import { createLlmProvider } from "./services/llm/llmProvider.js";

const TOP = 5;

try {
  await sequelize.authenticate();
  // ASSISTANT_SEARCH_TERMS=off measures the search the way it then runs:
  // with the question itself, without the model
  const provider = searchTermsEnabled() ? createLlmProvider() : null;
  let found = 0;
  const misses: string[] = [];

  for (const item of EVAL_QUESTIONS) {
    const terms = await searchTerms(item.question, provider);
    const hits = await search(terms, { limit: TOP });
    const ok = hits.some((hit) =>
      item.expected.some((part) => hit.url.includes(part)),
    );
    if (ok) found++;
    else
      misses.push(
        `  - ${item.question}\n      got: ${hits.map((hit) => hit.url).join(", ") || "nothing"}`,
      );
  }

  const share = Math.round((found / EVAL_QUESTIONS.length) * 100);
  process.stdout.write(
    [
      `Search terms: ${provider ? provider.name : "the question itself (no language model)"}`,
      `A right page among the first ${TOP} sources: ${found} of ${EVAL_QUESTIONS.length} (${share} %)`,
      ...(misses.length > 0 ? ["Missed:", ...misses] : []),
      "",
    ].join("\n"),
  );
} catch (error: unknown) {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
} finally {
  await sequelize.close();
}
