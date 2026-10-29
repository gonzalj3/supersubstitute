export type PracticeItem = {
  id: string;
  prompt: string;
  answer: string;
  skill: string;
  denominator: number;
  steps: string[];
  left?: string;
  right?: string;
  depth?: string;
  operation?: string;
  origin?: string;
  unit?: string;
};
export const ITEMS: PracticeItem[] = [
  {
    id: "mixed-add",
    prompt: "2 1/3 + 1 3/4",
    answer: "49/12",
    skill: "Add mixed numbers",
    denominator: 12,
    steps: [
      "Keep the whole numbers: 2 + 1 = 3.",
      "Use twelfths: 1/3 = 4/12 and 3/4 = 9/12.",
      "Add: 3 + 13/12 = 4 1/12.",
    ],
  },
  {
    id: "fraction-add",
    prompt: "2/3 + 1/4",
    answer: "11/12",
    skill: "Find a common denominator",
    denominator: 12,
    steps: [
      "Thirds and fourths need equal-sized pieces.",
      "Use twelfths: 2/3 = 8/12 and 1/4 = 3/12.",
      "Add the numerators: 8/12 + 3/12 = 11/12.",
    ],
  },
  {
    id: "mixed-subtract",
    prompt: "3 1/4 − 1 2/3",
    answer: "19/12",
    skill: "Regroup to subtract",
    denominator: 12,
    steps: [
      "Use twelfths: 3 3/12 − 1 8/12.",
      "Regroup one whole: 3 3/12 = 2 15/12.",
      "Subtract: 2 15/12 − 1 8/12 = 1 7/12.",
    ],
  },
  {
    id: "fraction-subtract",
    prompt: "5/6 − 1/4",
    answer: "7/12",
    skill: "Subtract unlike fractions",
    denominator: 12,
    steps: [
      "Find a common denominator for sixths and fourths.",
      "Rewrite: 5/6 = 10/12 and 1/4 = 3/12.",
      "Subtract: 10/12 − 3/12 = 7/12.",
    ],
  },
  {
    id: "mixed-add-2",
    prompt: "1 5/6 + 2 1/2",
    answer: "13/3",
    skill: "Rename an improper fraction",
    denominator: 6,
    steps: [
      "Keep the whole numbers: 1 + 2 = 3.",
      "Rewrite 1/2 as 3/6, then add 5/6 + 3/6.",
      "3 + 8/6 = 4 1/3.",
    ],
  },
];
export function parseFraction(input: string): string {
  const s = input.trim();
  if (s.length > 32) throw new Error("Enter a smaller number.");
  let n: number, d: number;
  const mixed = s.match(/^(-?)(\d+)\s+(\d+)\/(\d+)$/),
    frac = s.match(/^(-?\d+)\/(\d+)$/),
    dec = s.match(/^-?\d+(?:\.\d{1,6})?$/);
  if (mixed) {
    const [, sign, w, a, b] = mixed;
    d = Number(b);
    if (Number(a) >= d) throw new Error("Use a proper fractional part.");
    n = (Number(w) * d + Number(a)) * (sign ? -1 : 1);
  } else if (frac) {
    n = Number(frac[1]);
    d = Number(frac[2]);
  } else if (dec) {
    d = 10 ** (s.split(".")[1]?.length ?? 0);
    n = Math.round(Number(s) * d);
  } else
    throw new Error("Use a fraction like 3/4 or a mixed number like 2 1/3.");
  if (
    !d ||
    !Number.isSafeInteger(n) ||
    !Number.isSafeInteger(d) ||
    Math.abs(n) > 1e9 ||
    d > 1e6
  )
    throw new Error("Use a valid fraction with a nonzero denominator.");
  let a = Math.abs(n),
    b = d;
  while (b) {
    [a, b] = [b, a % b];
  }
  return `${n / (a || 1)}/${d / (a || 1)}`;
}
export type Student = {
  id: string;
  token: string;
  label: string;
  simulated: boolean;
  index: number;
  hints: Record<string, number>;
};
export type Grade = {
  correct: boolean;
  errorType: string | null;
  hintLevel: number;
  hint: string;
  nextIndex: number;
};
type Attempt = {
  studentId: string;
  itemId: string;
  value: string;
  correct: boolean;
  errorType: string | null;
  at: number;
};
export type Room = {
  items?: PracticeItem[];
  lesson?: {
    title: string;
    objective: string;
    grade: number;
    state: string;
    standard: string;
    sources: { title: string; url: string }[];
    tools: import("./prep-types").InteractiveTool[];
    packId: string;
    revision: number;
  };
  phase: "live" | "closed";
  createdAt: number;
  students: Student[];
  attempts: Attempt[];
  requests: Record<string, { fingerprint: string; result: Grade }>;
  report?: Handoff;
  adminToken: string;
  simulationTick: number;
  messages?: TeacherMessage[];
  tutorRequests?: Record<string, number>;
};
export const roomItems = (room: Room): PracticeItem[] => room.items ?? ITEMS;
export type TeacherMessage = {
  id: string;
  studentId: string;
  label: string;
  text: string;
  at: number;
};
export type SeatSummary = {
  id: string;
  label: string;
  simulated: boolean;
  correct: number;
  attempted: number;
  mastery: number;
  status: string;
  errorType: string | null;
  hintLevel: number;
};
export type Cluster = { type: string; label: string; students: string[] };
export type Handoff = {
  standard: string;
  closedAt: number;
  attempts: number;
  students: SeatSummary[];
  misconceptions: Cluster[];
  narrative: string;
  delivery: string;
  messages?: TeacherMessage[];
};
export function messageTeacher(
  r: Room,
  input: { studentId: string; token: string; requestId: string; text: string },
): TeacherMessage {
  const student = r.students.find(
    (s) => s.id === input.studentId && s.token === input.token,
  );
  if (!student) throw new Error("Invalid student session.");
  if (
    typeof input.text !== "string" ||
    !input.text.trim() ||
    input.text.length > 1000
  )
    throw new Error("Write a message of 1–1000 characters.");
  if (
    typeof input.requestId !== "string" ||
    !/^[\w-]{1,80}$/.test(input.requestId)
  )
    throw new Error("Invalid request ID.");
  const messages = (r.messages ??= []);
  const id = `${student.id}:${input.requestId}`;
  const prior = messages.find((m) => m.id === id);
  if (prior) {
    if (prior.text !== input.text.trim())
      throw new Error("Request ID reused with different content.");
    return prior;
  }
  if (r.phase !== "live") throw new Error("This period is closed.");
  if (messages.filter((m) => m.studentId === student.id).length >= 20)
    throw new Error("Message limit reached. Please speak to the substitute.");
  const message = {
    id,
    studentId: student.id,
    label: student.label,
    text: input.text.trim(),
    at: Date.now(),
  };
  messages.push(message);
  return message;
}
export function tutorContext(
  r: Room,
  input: {
    studentId: string;
    token: string;
    text: string;
    history?: { role: "user" | "assistant"; content: string }[];
  },
) {
  const student = r.students.find(
    (s) => s.id === input.studentId && s.token === input.token,
  );
  if (!student) throw new Error("Invalid student session.");
  if (r.phase !== "live") throw new Error("This period is closed.");
  if (
    typeof input.text !== "string" ||
    !input.text.trim() ||
    input.text.length > 1000
  )
    throw new Error("Write a question of 1–1000 characters.");
  if (
    input.history !== undefined &&
    (!Array.isArray(input.history) ||
      input.history.length > 4 ||
      input.history.some(
        (turn) =>
          !turn ||
          !["user", "assistant"].includes(turn.role) ||
          typeof turn.content !== "string" ||
          turn.content.length > 600,
      ))
  )
    throw new Error("Invalid conversation history.");
  const requests = (r.tutorRequests ??= {});
  if (Date.now() - (requests[student.id] ?? 0) < 15000)
    throw new Error(
      "Please wait a few seconds before asking another question.",
    );
  requests[student.id] = Date.now();
  const items = roomItems(r),
    item = items[Math.min(student.index, items.length - 1)];
  return {
    question: input.text.trim(),
    grade: r.lesson?.grade ?? 5,
    objective:
      r.lesson?.objective ?? "Add and subtract fractions and mixed numbers",
    conversation: input.history ?? [],
    practice: { prompt: item.prompt, skill: item.skill },
    recentWork: r.attempts
      .filter((a) => a.studentId === student.id)
      .slice(-4)
      .map((a) => ({
        item: items.find((i) => i.id === a.itemId)?.prompt,
        answer: a.value,
        correct: a.correct,
      })),
  };
}
export function newRoom(): Room {
  return {
    phase: "live",
    createdAt: Date.now(),
    students: [],
    attempts: [],
    requests: {},
    adminToken: crypto.randomUUID(),
    simulationTick: 0,
  };
}
export function join(r: Room, label: string, simulated: boolean): Student {
  if (r.phase !== "live") throw new Error("This period is closed.");
  if (!/^[\w -]{1,24}$/.test(label.trim()))
    throw new Error(
      "Use a seat label of 1–24 letters, numbers, spaces or dashes.",
    );
  if (r.students.length >= 32) throw new Error("Room is full.");
  if (
    r.students.some((s) => s.label.toLowerCase() === label.trim().toLowerCase())
  )
    throw new Error("That seat is already in use. Pick another label.");
  const s: Student = {
    id: crypto.randomUUID(),
    token: crypto.randomUUID(),
    label: label.trim(),
    simulated,
    index: 0,
    hints: {},
  };
  r.students.push(s);
  return s;
}
function classify(itemId: string, value: string) {
  const v = parseFraction(value);
  const denominatorMistakes: Record<string, string> = {
    "mixed-add": "25/7",
    "fraction-add": "3/7",
    "mixed-add-2": "15/4",
  };
  if (v === denominatorMistakes[itemId]) return "adds_denominators";
  if (itemId === "mixed-add" && v === "13/12") return "ignores_whole_number";
  if (itemId === "mixed-subtract") return "no_regrouping";
  return "common_denominator";
}
export const ERROR_LABELS: Record<string, string> = {
  adds_denominators: "Adding the denominators",
  ignores_whole_number: "Losing the whole numbers",
  no_regrouping: "Regrouping before subtraction",
  common_denominator: "Finding equivalent fractions",
  practice_step: "A step to revisit",
};
export function answer(
  r: Room,
  input: {
    requestId: string;
    studentId: string;
    token: string;
    itemId: string;
    value: string;
  },
): Grade {
  const s = r.students.find(
    (s) => s.id === input.studentId && s.token === input.token,
  );
  if (!s) throw new Error("Invalid student session.");
  if (
    typeof input.requestId !== "string" ||
    !/^[\w-]{1,80}$/.test(input.requestId)
  )
    throw new Error("Invalid request ID.");
  const fingerprint = JSON.stringify([
    input.studentId,
    input.itemId,
    input.value,
  ]);
  const key = `${input.studentId}:${input.requestId}`,
    previous = r.requests[key];
  if (previous) {
    if (previous.fingerprint !== fingerprint)
      throw new Error("Request ID reused with different content.");
    return previous.result;
  }
  if (r.phase !== "live") throw new Error("This period is closed.");
  if (r.attempts.length >= 2000) throw new Error("Demo attempt limit reached.");
  const item = roomItems(r)[s.index];
  if (!item || item.id !== input.itemId)
    throw new Error("Refresh to get your current question.");
  const correct = parseFraction(input.value) === parseFraction(item.answer),
    errorType = correct
      ? null
      : r.lesson &&
          !r.lesson.objective.toLowerCase().includes("fraction") &&
          !r.lesson.objective.toLowerCase().includes("mixed")
        ? "practice_step"
        : classify(item.id, input.value);
  const level = correct ? 0 : Math.min(3, (s.hints[item.id] ?? 0) + 1);
  s.hints[item.id] = level;
  if (correct) s.index++;
  const hints = [
    "Try making the fractional pieces the same size first.",
    item.operation && !["add", "subtract"].includes(item.operation)
      ? item.steps[0]
      : `Use ${item.denominator} as a common denominator. Rename each fraction before combining.`,
    item.steps.slice(0, 2).join(" "),
  ];
  if (r.lesson) {
    hints[0] =
      "Try representing the quantities with one of the interactive tools. What does each number count?";
    hints[1] = item.steps[0];
    hints[2] = item.steps.slice(0, 2).join(" ");
  }
  const hint = correct
    ? "You got it. Those fractions are equivalent!"
    : errorType === "ignores_whole_number" && level === 1
      ? "You found the fractional sum. What happens to the whole numbers?"
      : hints[level - 1];
  const result = {
    correct,
    errorType,
    hintLevel: level,
    hint,
    nextIndex: s.index,
  };
  r.attempts.push({
    studentId: s.id,
    itemId: item.id,
    value: input.value,
    correct,
    errorType,
    at: Date.now(),
  });
  r.requests[key] = { fingerprint, result };
  return result;
}
export function summarize(r: Room): {
  phase: string;
  createdAt: number;
  students: SeatSummary[];
  clusters: Cluster[];
  attempts: number;
  correct: number;
  items: number;
  report: Handoff | null;
  messages: TeacherMessage[];
  lesson: Room["lesson"] | null;
} {
  const students = r.students.map((s) => {
    const attempts = r.attempts.filter((a) => a.studentId === s.id);
    const last = attempts.at(-1);
    const attempted = new Set(attempts.map((a) => a.itemId)).size;
    return {
      id: s.id,
      label: s.label,
      simulated: s.simulated,
      correct: s.index,
      attempted,
      mastery: attempted ? s.index / attempted : 0,
      status:
        s.index === roomItems(r).length
          ? "complete"
          : last && !last.correct
            ? "needs-help"
            : attempts.length
              ? "practicing"
              : "ready",
      errorType: last && !last.correct ? last.errorType : null,
      hintLevel: s.hints[roomItems(r)[s.index]?.id] ?? 0,
    };
  });
  const clusters = Object.keys(ERROR_LABELS)
    .map((type) => ({
      type,
      label: ERROR_LABELS[type],
      students: students
        .filter((s) => s.errorType === type)
        .map((s) => s.label),
    }))
    .filter((c) => c.students.length);
  return {
    phase: r.phase,
    createdAt: r.createdAt,
    students,
    clusters,
    attempts: r.attempts.length,
    correct: r.attempts.filter((a) => a.correct).length,
    items: roomItems(r).length,
    report: r.report ?? null,
    messages: r.messages ?? [],
    lesson: r.lesson ?? null,
  };
}
export function closeRoom(r: Room): Handoff {
  if (r.report) return r.report;
  r.phase = "closed";
  const snap = summarize(r);
  r.report = {
    standard: r.lesson?.standard ?? "CA · 5.NF.A.1",
    closedAt: Date.now(),
    attempts: r.attempts.length,
    students: snap.students,
    misconceptions: snap.clusters,
    messages: structuredClone(snap.messages),
    narrative: `${snap.students.length} seats practiced ${r.lesson?.objective ?? "adding and subtracting fractions"}. ${snap.correct} items were solved correctly across ${snap.attempts} attempts. ${snap.students.filter((s) => s.status === "needs-help").length} seats need a follow-up. Simulated seats are labeled individually.`,
    delivery:
      "Draft only · One not connected; no email or calendar event sent.",
  };
  return r.report;
}
