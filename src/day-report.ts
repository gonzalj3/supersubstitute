import type { Handoff } from "./domain";
import type { AbsenceRecord } from "./prep-types";
export type PeriodReport = {
  roomId: string;
  closedAt: number;
  narrative: string;
  attempts: number;
  correct: number;
  seats: number;
  simulated: number;
  followUp: string[];
  misconceptions: string[];
  messageCount: number;
};
export function summarizePeriod(roomId: string, report: Handoff): PeriodReport {
  return {
    roomId,
    closedAt: report.closedAt,
    narrative: report.narrative,
    attempts: report.attempts,
    correct: report.students.reduce((sum, s) => sum + s.correct, 0),
    seats: report.students.length,
    simulated: report.students.filter((s) => s.simulated).length,
    followUp: report.students
      .filter((s) => s.status === "needs-help")
      .map((s) => s.label),
    misconceptions: report.misconceptions.map(
      (m) => `${m.label}: ${m.students.join(", ")}`,
    ),
    messageCount: report.messages?.length ?? 0,
  };
}
export function queueDayReport(record: AbsenceRecord): boolean {
  if (!record.input.periods.every((p) => record.periodReports?.[p.id]))
    return false;
  const settings = record.reportDelivery ?? {
    teacherEmail: record.input.teacherEmail ?? "",
    administratorEmail: record.input.administratorEmail,
    enabled: !record.input.sandbox,
  };
  const recipients = [
    ...new Set(
      [settings.teacherEmail, settings.administratorEmail]
        .filter(Boolean)
        .map((e) => e.toLowerCase()),
    ),
  ];
  const sections = record.input.periods.map((p) => {
    const r = record.periodReports![p.id];
    return `${p.label} (${p.start}–${p.end})\n${r.narrative}\nCorrect responses: ${r.correct}; attempts: ${r.attempts}; seats: ${r.seats} (${r.simulated} simulated).\nSuggested follow-up: ${r.followUp.join(", ") || "No seats flagged"}.\nSticking points: ${r.misconceptions.join("; ") || "None recorded"}.\nStudent messages saved in classroom handoff: ${r.messageCount}.`;
  });
  for (const recipient of recipients) {
    const id = `${record.revision}:day-report:${recipient}`;
    const existing = record.outbox.find((m) => m.id === id);
    if (existing) {
      if (existing.status === "sandbox" && settings.enabled)
        existing.status = "awaiting_connection";
      continue;
    }
    record.outbox.push({
      id,
      type: "day-report",
      recipient,
      subject: `End-of-day report · ${record.input.teacherLabel} · ${record.input.date}`,
      text: `SuperSubstitute day summary\n${record.input.schoolLabel} · ${record.input.date}\nGrade ${record.input.grade}: ${record.input.objective}\nStandard: ${record.pack?.standard.code ?? "See reviewed lesson pack"}\n\n${sections.join("\n\n")}\n\nThese results describe recorded practice, not a formal assessment. Simulated activity is labeled.`,
      status: settings.enabled ? "awaiting_connection" : "sandbox",
      createdAt: new Date().toISOString(),
    });
  }
  return true;
}
