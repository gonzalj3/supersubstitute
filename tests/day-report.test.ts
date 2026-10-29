import { it, expect } from "vitest";
import { createAbsence, validateInput } from "../src/preparation";
import { queueDayReport } from "../src/day-report";
const make = () =>
  createAbsence(
    "absence",
    validateInput({
      teacherLabel: "Teacher",
      schoolLabel: "School",
      date: "2026-10-29",
      timezone: "America/Los_Angeles",
      grade: 5,
      state: "CA",
      topic: "fractions-add",
      objective: "Add mixed numbers",
      teacherEmail: "teacher@example.com",
      administratorEmail: "admin@example.com",
      sandbox: false,
      periods: [
        { id: "one", label: "Morning", start: "09:00", end: "09:45" },
        { id: "two", label: "Afternoon", start: "13:00", end: "13:45" },
      ],
    }),
  );
const period = {
  roomId: "room",
  closedAt: 1,
  narrative: "Practice saved.",
  attempts: 4,
  correct: 2,
  seats: 1,
  simulated: 0,
  followUp: ["Seat 1"],
  misconceptions: ["Equivalent fractions"],
  messageCount: 1,
};
it("waits for every planned period, then queues one report per recipient exactly once", () => {
  const r = make();
  r.periodReports = { one: period };
  expect(queueDayReport(r)).toBe(false);
  expect(r.outbox.filter((m) => m.type === "day-report")).toHaveLength(0);
  r.periodReports.two = { ...period, roomId: "other" };
  expect(queueDayReport(r)).toBe(true);
  queueDayReport(r);
  const reports = r.outbox.filter((m) => m.type === "day-report");
  expect(reports).toHaveLength(2);
  expect(reports[0].text).toContain("Afternoon");
  expect(reports[0].text).toContain("Seat 1");
  expect(reports.every((m) => m.status === "awaiting_connection")).toBe(true);
});
it("deduplicates matching recipients and respects sandbox delivery", () => {
  const r = make();
  r.reportDelivery = {
    teacherEmail: "same@example.com",
    administratorEmail: "same@example.com",
    enabled: false,
  };
  r.periodReports = { one: period, two: period };
  queueDayReport(r);
  expect(r.outbox.filter((m) => m.type === "day-report")).toHaveLength(1);
  expect(r.outbox.at(-1)?.status).toBe("sandbox");
});
