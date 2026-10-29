import { describe, it, expect } from "vitest";
import { initialFractionLab, stepFractionLab } from "../src/fraction-lab";
describe("guided mixed-number model", () => {
  it("requires both equivalent fractions before combining", () => {
    let s = stepFractionLab(initialFractionLab(), { type: "split" });
    s = stepFractionLab(s, { type: "choose", part: "third", value: 3 });
    s = stepFractionLab(s, { type: "choose", part: "fourth", value: 9 });
    expect(stepFractionLab(s, { type: "combine" }).stage).toBe("rename");
    s = stepFractionLab(s, { type: "choose", part: "third", value: 4 });
    expect(stepFractionLab(s, { type: "combine" }).stage).toBe("combine");
  });
  it("only regroups after combining, and preserves choices when going back", () => {
    expect(
      stepFractionLab(initialFractionLab(), { type: "regroup" }).stage,
    ).toBe("compare");
    let s = stepFractionLab(initialFractionLab(), { type: "split" });
    s = stepFractionLab(s, { type: "choose", part: "third", value: 4 });
    s = stepFractionLab(s, { type: "choose", part: "fourth", value: 9 });
    s = stepFractionLab(s, { type: "combine" });
    expect(stepFractionLab(s, { type: "regroup" }).stage).toBe("regroup");
    expect(stepFractionLab(s, { type: "back" }).third).toBe(4);
    expect(stepFractionLab(s, { type: "reset" })).toEqual(initialFractionLab());
  });
});
