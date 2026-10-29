import { z } from "zod";
import type { MathProblem } from "./math-engine";
export const TOPICS = [
  "auto",
  "fractions-add",
  "fractions-subtract",
  "decimals",
  "multiplication",
  "division",
  "area-perimeter",
  "volume",
] as const;
export type Topic = Exclude<(typeof TOPICS)[number], "auto">;
export const TOPIC_LABELS: Record<Topic, string> = {
  "fractions-add":
    "adding fractions and mixed numbers with unlike denominators",
  "fractions-subtract":
    "subtracting fractions and mixed numbers with regrouping",
  decimals: "adding and subtracting decimals through place value",
  multiplication: "multiplication with equal groups and arrays",
  division: "division through equal groups",
  "area-perimeter": "area and perimeter of rectangles",
  volume: "volume of rectangular prisms using unit cubes",
};
export const AbsenceInputSchema = z.object({
  teacherLabel: z.string().trim().min(1).max(80),
  schoolLabel: z.string().trim().min(1).max(100),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  timezone: z.enum([
    "America/Los_Angeles",
    "America/Denver",
    "America/Chicago",
    "America/New_York",
  ]),
  grade: z.number().int().min(3).max(8),
  state: z.enum(["CA", "TX"]),
  topic: z.enum(TOPICS),
  objective: z.string().trim().min(8).max(2000),
  curriculumRef: z.string().max(500).default(""),
  teacherQuestions: z.string().max(6000).default(""),
  administratorEmail: z.union([z.email(), z.literal("")]).default(""),
  periods: z
    .array(
      z.object({
        id: z.string().regex(/^[\w-]{1,40}$/),
        label: z.string().min(1).max(60),
        start: z.string().regex(/^\d{2}:\d{2}$/),
        end: z.string().regex(/^\d{2}:\d{2}$/),
      }),
    )
    .min(1)
    .max(6),
  substitutes: z
    .array(
      z.object({
        id: z.string().regex(/^[\w-]{1,40}$/),
        label: z.string().min(1).max(80),
        email: z.union([z.email(), z.literal("")]),
        available: z.boolean(),
        grades: z.array(z.number().int().min(1).max(12)).min(1).max(12),
      }),
    )
    .max(8)
    .default([]),
  sandbox: z.boolean().default(true),
});
export type AbsenceInput = z.infer<typeof AbsenceInputSchema>;
export type EvidenceSource = {
  id: string;
  title: string;
  url: string;
  excerpt: string;
  kind: "standard" | "curriculum";
  retrievedAt: string;
  contentVerified: boolean;
  content?: string;
};
export type InteractiveTool = {
  id: string;
  kind:
    | "fraction-bars"
    | "number-line"
    | "place-value"
    | "array"
    | "rectangle"
    | "cubes"
    | "error-detective";
  title: string;
  problemId: string;
};
export const DraftSchema = z.object({
  title: z.string(),
  objective: z.string(),
  topic: z.enum(TOPICS.slice(1) as [Topic, ...Topic[]]),
  standard: z.object({
    code: z.string(),
    sourceId: z.string(),
    evidenceQuote: z.string(),
  }),
  items: z.array(
    z.object({
      left: z.string(),
      right: z.string(),
      depth: z.string(),
      operation: z.enum([
        "add",
        "subtract",
        "multiply",
        "divide",
        "area",
        "perimeter",
        "volume",
      ]),
      skill: z.string(),
    }),
  ),
  guide: z.object({
    overview: z.string(),
    steps: z.array(
      z.object({
        say: z.string(),
        show: z.string(),
        ask: z.string(),
        lookFor: z.string(),
      }),
    ),
    misconceptions: z.array(
      z.object({ title: z.string(), action: z.string() }),
    ),
    schedule: z.array(z.object({ minutes: z.number(), title: z.string() })),
  }),
});
export type Draft = z.infer<typeof DraftSchema>;
export type LessonPack = {
  id: string;
  revision: number;
  createdAt: string;
  title: string;
  objective: string;
  topic: Topic;
  grade: number;
  state: string;
  standard: Draft["standard"];
  sources: EvidenceSource[];
  items: MathProblem[];
  tools: InteractiveTool[];
  guide: Draft["guide"];
  videos: import("./video-search").VideoResult[];
  validation: { math: boolean; alignment: boolean; issues: string[] };
  orchestrator: "edge" | "crewai";
};
export type PrepPhase =
  | "queued"
  | "research"
  | "design"
  | "validation"
  | "ready"
  | "needs_review"
  | "published"
  | "canceled"
  | "failed"
  | "unsupported";
export type OutboxMessage = {
  id: string;
  type: string;
  recipient: string;
  subject: string;
  text: string;
  status: "sandbox" | "awaiting_connection" | "sent" | "unknown";
  createdAt: string;
};
export type Invitation = {
  id: string;
  token: string;
  substituteId: string;
  label: string;
  status: "invited" | "accepted" | "expired";
};
export type AbsenceRecord = {
  id: string;
  ownerToken: string;
  adminToken: string;
  revision: number;
  input: AbsenceInput;
  phase: PrepPhase;
  createdAt: string;
  updatedAt: string;
  pack?: LessonPack;
  error?: string;
  events: { at: string; phase: string; message: string }[];
  outbox: OutboxMessage[];
  invitations: Invitation[];
  assigned?: { id: string; label: string; token: string };
  rooms: Record<string, { id: string; adminToken: string }>;
  alignmentReviewed?: boolean;
};
