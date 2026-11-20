// Measures the assistant's answers: asks the language model each question
// in knowledge/evalAnswers.ts, as the real assistant does, and checks that
// the answer holds the right dates and none of the wrong ones.
// Needs a language model (AI_PROVIDER) and the knowledge base:
//   npm run knowledge
//   npm run eval:answers
import "reflect-metadata";
import "dotenv/config";
import { sequelize } from "./config/database.js";
import {
  ANSWER_CHECKS,
  checkAnswer,
  EVAL_TODAY,
} from "./knowledge/evalAnswers.js";
import { ask, companyContext } from "./services/assistantService.js";
import { createLlmProvider } from "./services/llm/llmProvider.js";
import {
  companyRulesSource,
  generalRulesSource,
} from "./services/rulesSource.js";

try {
  const provider = createLlmProvider();
  if (!provider) {
    throw new Error(
      "No language model is set up. Set AI_PROVIDER in .env (see env_example).",
    );
  }
  await sequelize.authenticate();

  let passed = 0;
  const report: string[] = [];
  const started = Date.now();

  for (const check of ANSWER_CHECKS) {
    const rules = check.about
      ? companyRulesSource(
          {
            id: "eval",
            companySnapshot: check.about.company,
            answers: check.about.answers,
          },
          EVAL_TODAY,
          check.language,
        )
      : generalRulesSource(check.language);
    const result = await ask({
      question: check.question,
      language: check.language,
      context: check.about ? companyContext(check.about.company) : null,
      rules,
    });

    const answer = result.answer ?? "";
    const { missing, forbidden } =
      result.mode === "answer"
        ? checkAnswer(check, answer)
        : { missing: check.mustContain, forbidden: [] };
    const ok =
      result.mode === "answer" &&
      missing.length === 0 &&
      forbidden.length === 0;
    if (ok) passed++;

    report.push(
      `${ok ? "PASS" : "FAIL"}  ${check.question}${check.about ? ` (${check.about.company.organizationForm})` : ""}`,
    );
    if (!ok) {
      if (result.mode !== "answer")
        report.push("      the model did not answer; only sources were given");
      for (const pattern of missing) report.push(`      missing: ${pattern}`);
      for (const pattern of forbidden)
        report.push(`      should not say: ${pattern}`);
      report.push(
        `      answer: ${answer.replace(/\s+/g, " ").slice(0, 600) || "-"}`,
      );
    }
  }

  const share = Math.round((passed / ANSWER_CHECKS.length) * 100);
  const minutes = ((Date.now() - started) / 60000).toFixed(1);
  process.stdout.write(
    [
      `Model: ${provider.name}`,
      ...report,
      `Right answers: ${passed} of ${ANSWER_CHECKS.length} (${share} %) in ${minutes} minutes`,
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
