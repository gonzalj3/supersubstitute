import { it, expect, describe } from "vitest";
import {
  validateInput,
  createAbsence,
  updatePhase,
  publishPack,
  detectTopic,
  buildPack,
} from "../src/preparation";
import type { Draft } from "../src/prep-types";
const input = () =>
  validateInput({
    teacherLabel: "Demo teacher",
    schoolLabel: "Demo school",
    date: "2026-10-29",
    timezone: "America/Los_Angeles",
    grade: 5,
    state: "CA",
    topic: "auto",
    objective: "Add mixed numbers with unlike denominators",
    periods: [{ id: "p1", label: "Math", start: "09:00", end: "09:45" }],
    substitutes: [
      { id: "s1", label: "Sub A", email: "", available: true, grades: [5] },
    ],
  });
describe("absence preparation safety", () => {
  it("saves coverage invitations independently of lesson preparation", () => {
    const r = createAbsence("a", input());
    expect(r.phase).toBe("queued");
    expect(r.invitations).toHaveLength(1);
    expect(r.outbox.every((m) => m.status === "sandbox")).toBe(true);
  });
  it("rejects overlapping periods and invalid calendar dates", () => {
    const i = input();
    expect(() => validateInput({ ...i, date: "2026-02-30" })).toThrow();
    expect(() =>
      validateInput({
        ...i,
        periods: [
          ...i.periods,
          { id: "p2", label: "Other", start: "09:30", end: "10:00" },
        ],
      }),
    ).toThrow(/overlap/);
  });
  it("blocks stale callbacks, canceled jobs, and unvalidated publication", () => {
    const r = createAbsence("a", input());
    expect(() => updatePhase(r, 2, "ready", "late")).toThrow(/stale/);
    expect(() => publishPack(r, true)).toThrow();
    r.phase = "canceled";
    expect(() => updatePhase(r, 1, "ready", "late")).toThrow();
  });
  it("detects topic independently from teacher identities", () => {
    expect(detectTopic(input())).toBe("fractions-add");
    expect(
      detectTopic({ ...input(), objective: "Find volume with unit cubes" }),
    ).toBe("volume");
    expect(() =>
      detectTopic({ ...input(), objective: "Solve simultaneous equations" }),
    ).toThrow(/Unsupported/);
  });
  it("preserves provided questions, calculates answers, and requires evidence review", () => {
    const r = createAbsence("a", {
      ...input(),
      teacherQuestions: "2 1/3 + 1 3/4 = 4 1/12",
    });
    const draft: Draft = {
      title: "Mixed numbers",
      objective: r.input.objective,
      topic: "fractions-add",
      standard: { code: "proposed", sourceId: "s", evidenceQuote: "" },
      items: [],
      guide: {
        overview: "Use equal pieces",
        steps: [
          {
            say: "Rename",
            show: "Twelfths",
            ask: "Equal sizes?",
            lookFor: "Both denominators",
          },
          {
            say: "Combine",
            show: "Sum",
            ask: "New whole?",
            lookFor: "Regroup",
          },
        ],
        misconceptions: [{ title: "Denominators", action: "Use same sizes" }],
        schedule: [{ minutes: 10, title: "Model" }],
      },
    };
    r.pack = buildPack(r, draft, [], []);
    r.phase = "needs_review";
    expect(r.pack.items).toHaveLength(1);
    expect(r.pack.items[0].prompt).toBe("2 1/3 + 1 3/4");
    expect(r.pack.items[0].answer).toBe("49/12");
    expect(() => publishPack(r, false)).toThrow(/Review/);
    publishPack(r, true);
    expect(r.phase).toBe("published");
  });
});
