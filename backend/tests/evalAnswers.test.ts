// The answer checks of `npm run eval:answers` must agree with the rules:
// a date the answer must hold has to be in source [1], and a date it must
// not hold must not be in a company's source [1].
import { describe, expect, it } from "vitest";
import {
  ANSWER_CHECKS,
  checkAnswer,
  EVAL_TODAY,
} from "../src/knowledge/evalAnswers.js";
import {
  companyRulesSource,
  generalRulesSource,
} from "../src/services/rulesSource.js";

function rulesTextFor(check: (typeof ANSWER_CHECKS)[number]): string {
  return check.about
    ? companyRulesSource(
        {
          id: "eval",
          companySnapshot: check.about.company,
          answers: check.about.answers,
        },
        EVAL_TODAY,
        check.language,
      ).text
    : generalRulesSource(check.language).text;
}

describe("the answer checks", () => {
  it("are eleven", () => {
    expect(ANSWER_CHECKS).toHaveLength(11);
  });

  // The question about fishing has nothing in the rules on purpose
  const dated = ANSWER_CHECKS.filter(
    (check) => !check.question.includes("torsk"),
  );

  for (const check of dated) {
    it(`expect only what source [1] says: ${check.question}`, () => {
      const text = rulesTextFor(check);
      // Source [1] is in Norwegian; an English answer is checked with
      // patterns that accept both languages
      expect(checkAnswer(check, text).missing).toEqual([]);
      if (check.about) {
        expect(checkAnswer(check, text).forbidden).toEqual([]);
      }
    });
  }

  it("accept the ways a model writes a date", () => {
    const check = ANSWER_CHECKS[1];
    if (!check) throw new Error("No English check");
    expect(
      checkAnswer(check, "Due 10 April and August 31 [1].").missing,
    ).toEqual([]);
    expect(
      checkAnswer(check, "Due 10. april 2027 and 31. august [1].").missing,
    ).toEqual([]);
    expect(checkAnswer(check, "Due 1 April [1].").missing).toHaveLength(2);
  });

  it("catch a wrong date", () => {
    const check = ANSWER_CHECKS[2];
    if (!check) throw new Error("No company check");
    expect(
      checkAnswer(check, "Din neste frist er 10. mars 2027 [1].").forbidden,
    ).toHaveLength(1);
    // A real answer: the right date, and the annual term named as what
    // the pages say for others
    expect(
      checkAnswer(
        check,
        "Din neste frist for mva-melding er 10. desember 2026 [1]. Kilde [3] og [4] oppgir 10. mars som frist for de som har søkt om og fått innvilget årstermin.",
      ),
    ).toEqual({ missing: [], forbidden: [] });
  });
});
