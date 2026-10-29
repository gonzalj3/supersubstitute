import {
  AbsenceInputSchema,
  TOPIC_LABELS,
  type AbsenceInput,
  type AbsenceRecord,
  type Draft,
  type EvidenceSource,
  type LessonPack,
  type Topic,
} from "./prep-types";
import { makeProblem, parseTeacherProblem, rational } from "./math-engine";
export function validateInput(raw: unknown): AbsenceInput {
  const parsed = AbsenceInputSchema.safeParse(raw);
  if (!parsed.success)
    throw new Error(
      parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; "),
    );
  const input = parsed.data;
  const date = new Date(`${input.date}T12:00:00Z`);
  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== input.date
  )
    throw new Error("Enter a valid absence date.");
  if (new Set(input.periods.map((p) => p.id)).size !== input.periods.length)
    throw new Error("Each period needs a unique ID.");
  for (const p of input.periods) {
    if (
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(p.start) ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(p.end) ||
      p.end <= p.start
    )
      throw new Error(
        `${p.label}: the end must be after the start on the same day.`,
      );
  }
  const sorted = [...input.periods].sort((a, b) =>
    a.start.localeCompare(b.start),
  );
  for (let i = 1; i < sorted.length; i++)
    if (sorted[i].start < sorted[i - 1].end)
      throw new Error("Class periods cannot overlap.");
  if (
    new Set(input.substitutes.map((s) => s.id)).size !==
    input.substitutes.length
  )
    throw new Error("Substitute IDs must be unique.");
  return input;
}
export function detectTopic(input: AbsenceInput): Topic {
  if (input.topic !== "auto") return input.topic;
  const text = input.objective.toLowerCase();
  if (/volume|prism|cubic/.test(text)) return "volume";
  if (/area|perimeter|rectangle/.test(text)) return "area-perimeter";
  if (/decimal|hundredth|tenth/.test(text)) return "decimals";
  if (/fraction|mixed number/.test(text))
    return /subtract|difference|regroup/.test(text)
      ? "fractions-subtract"
      : "fractions-add";
  if (/divid|division|quotient/.test(text)) return "division";
  if (/multipli|times|equal group|arrays?/.test(text)) return "multiplication";
  throw new Error(
    "Unsupported objective. Choose one of the supported math topics or describe fractions, decimals, multiplication, division, rectangles, or volume.",
  );
}
export function createAbsence(
  id: string,
  input: AbsenceInput,
  revision = 1,
): AbsenceRecord {
  const now = new Date().toISOString(),
    record: AbsenceRecord = {
      id,
      ownerToken: crypto.randomUUID(),
      adminToken: crypto.randomUUID(),
      revision,
      input,
      phase: input.grade > 5 ? "unsupported" : "queued",
      createdAt: now,
      updatedAt: now,
      events: [],
      outbox: [],
      invitations: [],
      rooms: {},
    };
  if (input.grade > 5)
    record.error =
      "This elementary pilot supports grades 3–5. No unrelated tools will be generated.";
  record.events.push({
    at: now,
    phase: record.phase,
    message: "Absence saved. Lesson preparation and coverage are independent.",
  });
  record.outbox.push({
    id: `${revision}:absence-admin`,
    type: "absence",
    recipient: input.administratorEmail || "Administrator workspace",
    subject: `Teacher absence: ${input.teacherLabel} · ${input.date}`,
    text: `${input.teacherLabel} will be absent at ${input.schoolLabel} on ${input.date}. ${input.periods.map((p) => `${p.label} ${p.start}–${p.end}`).join("; ")} (${input.timezone}). Grade ${input.grade}. Lesson: ${input.objective}.`,
    status: input.sandbox ? "sandbox" : "awaiting_connection",
    createdAt: now,
  });
  for (const sub of input.substitutes.filter(
    (s) => s.available && s.grades.includes(input.grade),
  )) {
    const invitation = {
      id: crypto.randomUUID(),
      token: crypto.randomUUID(),
      substituteId: sub.id,
      label: sub.label,
      status: "invited" as const,
    };
    record.invitations.push(invitation);
    record.outbox.push({
      id: `${revision}:invite:${sub.id}`,
      type: "invitation",
      recipient: sub.email || sub.label,
      subject: `Coverage invitation · ${input.schoolLabel} · ${input.date}`,
      text: `Grade ${input.grade}, ${input.periods.map((p) => `${p.start}–${p.end}`).join(", ")} ${input.timezone}. Availability is declared by the school; acceptance checks conflicts.`,
      status: input.sandbox ? "sandbox" : "awaiting_connection",
      createdAt: now,
    });
  }
  return record;
}
export function updatePhase(
  record: AbsenceRecord,
  revision: number,
  phase: AbsenceRecord["phase"],
  message: string,
) {
  if (
    record.revision !== revision ||
    record.phase === "canceled" ||
    record.phase === "published"
  )
    throw new Error("This job is stale or the absence is no longer editable.");
  record.phase = phase;
  record.updatedAt = new Date().toISOString();
  record.events.push({ at: record.updatedAt, phase, message });
}
export function buildPack(
  record: AbsenceRecord,
  draft: Draft,
  sources: EvidenceSource[],
  videos: LessonPack["videos"],
  orchestrator: LessonPack["orchestrator"] = "edge",
): LessonPack {
  const topic = detectTopic(record.input),
    lines = record.input.teacherQuestions
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
  if (draft.topic !== topic)
    throw new Error(
      "The generated lesson topic does not match the requested topic.",
    );
  if (lines.length > 12)
    throw new Error("Supply at most 12 teacher questions.");
  const items = lines.length
    ? lines.map(parseTeacherProblem)
    : draft.items.map((item, i) =>
        makeProblem({
          ...item,
          id: `generated-${i + 1}`,
          skill: item.skill.slice(0, 120),
        }),
      );
  if (!items.length || items.length > 12)
    throw new Error("The lesson needs 1–12 valid practice questions.");
  if (!lines.length && (items.length < 6 || items.length > 8))
    throw new Error("Generated practice must contain six to eight questions.");
  const allowed: Record<Topic, string[]> = {
    "fractions-add": ["add"],
    "fractions-subtract": ["subtract"],
    decimals: ["add", "subtract"],
    multiplication: ["multiply"],
    division: ["divide"],
    "area-perimeter": ["area", "perimeter"],
    volume: ["volume"],
  };
  for (const item of items) {
    if (rational(item.answer)[0] < 0n)
      throw new Error(
        "This elementary visual-model pilot requires nonnegative answers.",
      );
    if (
      topic === "decimals" &&
      [item.left, item.right].some(
        (v) => Number(rational(v)[0]) / Number(rational(v)[1]) > 99,
      )
    )
      throw new Error(
        "The place-value model currently supports decimal operands up to 99.",
      );
    if (!allowed[topic].includes(item.operation))
      throw new Error(
        `Question ${item.id} uses ${item.operation}, outside this lesson topic.`,
      );
    if (
      ["fractions-add", "fractions-subtract"].includes(topic) &&
      item.denominator > 24
    )
      throw new Error(
        "Fraction models currently support common denominators up to 24.",
      );
    if (
      ["multiplication", "division", "area-perimeter", "volume"].includes(topic)
    ) {
      for (const v of [
        item.left,
        item.right,
        ...(item.depth ? [item.depth] : []),
      ]) {
        const [n, d] = rational(v);
        if (d !== 1n || n > 12n)
          throw new Error(
            "Visual models use whole-number factors and dimensions up to 12.",
          );
      }
    }
    if (topic === "division" && rational(item.answer)[1] !== 1n)
      throw new Error(
        "The equal-groups division model currently requires whole-number quotients.",
      );
  }
  const source = sources.find(
    (s) => s.id === draft.standard.sourceId && s.kind === "standard",
  );
  const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
  const quote = draft.standard.evidenceQuote.trim();
  const alignment = Boolean(
    source?.contentVerified &&
    quote.length >= 20 &&
    quote.split(/\s+/).length <= 25 &&
    normalize(source.content ?? "").includes(normalize(quote)) &&
    draft.standard.code.trim(),
  );
  const issues = alignment
    ? []
    : [
        "State alignment requires adult review: inspect the cited source and the proposed standard. No automatic compliance certification.",
      ];
  const problem = items[0],
    kinds: LessonPack["tools"][number]["kind"][] = topic.startsWith("fractions")
      ? ["fraction-bars", "number-line", "error-detective"]
      : topic === "decimals"
        ? ["place-value", "number-line", "error-detective"]
        : topic === "multiplication" || topic === "division"
          ? ["array", "number-line", "error-detective"]
          : topic === "volume"
            ? ["cubes", "error-detective"]
            : ["rectangle", "error-detective"];
  const titles: Record<string, string> = {
    "fraction-bars": "Build and rename the fractions",
    "number-line": "See it on a number line",
    "place-value": "Trade with place value",
    array: "Build equal groups",
    rectangle: "Explore area and perimeter",
    cubes: "Build layers of unit cubes",
    "error-detective": "Find and fix the mistake",
  };
  if (
    draft.guide.steps.length < 2 ||
    draft.guide.steps.length > 6 ||
    draft.guide.misconceptions.length < 1 ||
    draft.guide.schedule.length < 1
  )
    throw new Error(
      "The substitute guide needs 2–6 worked steps, misconceptions, and a period sequence.",
    );
  return {
    id: crypto.randomUUID(),
    revision: record.revision,
    createdAt: new Date().toISOString(),
    title: draft.title.slice(0, 140),
    objective: draft.objective.slice(0, 600),
    topic,
    grade: record.input.grade,
    state: record.input.state,
    standard: {
      ...draft.standard,
      evidenceQuote: quote.split(/\s+/).slice(0, 25).join(" "),
    },
    sources: sources.map(({ content, ...source }) => source),
    items,
    tools: kinds.map((kind, i) => ({
      id: `tool-${i + 1}`,
      kind,
      title: titles[kind],
      problemId: problem.id,
    })),
    guide: draft.guide,
    videos,
    validation: { math: true, alignment, issues },
    orchestrator,
  };
}
export function publishPack(record: AbsenceRecord, reviewed: boolean) {
  if (
    !["ready", "needs_review"].includes(record.phase) ||
    !record.pack ||
    !record.pack.validation.math
  )
    throw new Error(
      "Prepare and validate the current lesson before publishing.",
    );
  if (record.pack.revision !== record.revision)
    throw new Error("A stale lesson cannot publish.");
  if (!record.pack.validation.alignment && !reviewed)
    throw new Error(
      "Review the cited state guidance and confirm alignment before publishing.",
    );
  record.alignmentReviewed = reviewed;
  record.phase = "published";
  record.updatedAt = new Date().toISOString();
  record.events.push({
    at: record.updatedAt,
    phase: "published",
    message: "Adult reviewed and published this immutable lesson version.",
  });
  if (record.assigned)
    record.outbox.push({
      id: `${record.revision}:pack-ready:${record.assigned.id}`,
      type: "pack-ready",
      recipient: record.assigned.label,
      subject: `Preparation ready · ${record.pack.title}`,
      text: `Your lesson pack is ready for ${record.input.date}. Use the preparation link to rehearse before class.`,
      status: record.input.sandbox ? "sandbox" : "awaiting_connection",
      createdAt: record.updatedAt,
    });
}
