import { describe, it, expect } from "vitest";
import {
  calculate,
  makeProblem,
  parseTeacherProblem,
  displayRational,
} from "../src/math-engine";
describe("prepared lesson arithmetic", () => {
  it("calculates equivalent fractions, regrouping, and decimals exactly", () => {
    expect(calculate("2 1/3", "1 3/4", "add")).toBe("49/12");
    expect(calculate("3 1/4", "1 2/3", "subtract")).toBe("19/12");
    expect(calculate("0.1", "0.2", "add")).toBe("3/10");
    expect(displayRational("49/12")).toBe("4 1/12");
  });
  it("distinguishes geometry formulas and units", () => {
    expect(
      makeProblem({ id: "a", left: "5", right: "3", operation: "area" }),
    ).toMatchObject({ answer: "15/1", unit: "square units" });
    expect(calculate("5", "3", "perimeter")).toBe("16/1");
    expect(calculate("5", "3", "volume", "2")).toBe("30/1");
  });
  it("preserves teacher questions and detects incorrect supplied answers", () => {
    expect(parseTeacherProblem("2 1/3 + 1 3/4 = 4 1/12", 0)).toMatchObject({
      prompt: "2 1/3 + 1 3/4",
      origin: "teacher",
      answer: "49/12",
    });
    expect(() => parseTeacherProblem("1/0 + 1/2", 0)).toThrow();
    expect(() => parseTeacherProblem("1/3 + 1/4 = 2/7", 0)).toThrow(
      /disagrees/,
    );
  });
});
