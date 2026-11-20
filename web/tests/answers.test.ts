import { describe, expect, it } from "vitest";
import { answersFromForm } from "@/lib/answers";

describe("the answers in a submitted form", () => {
  it("are true, false or the option chosen", () => {
    const form = new FormData();
    form.set("vatTerm", "bimonthly");
    form.set("paysSalary", "false");
    form.set("expectsProfit", "true");

    expect(
      answersFromForm(form, ["vatTerm", "paysSalary", "expectsProfit"]),
    ).toEqual({
      answers: { vatTerm: "bimonthly", paysSalary: false, expectsProfit: true },
      missing: [],
    });
  });

  it("list the questions left unanswered, and nothing that was not asked", () => {
    const form = new FormData();
    form.set("paysSalary", "true");
    form.set("somethingElse", "x");

    expect(answersFromForm(form, ["vatTerm", "paysSalary"])).toEqual({
      answers: { paysSalary: true },
      missing: ["vatTerm"],
    });
  });
});
