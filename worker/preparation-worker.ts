import {
  DurableObject,
  WorkflowEntrypoint,
  type WorkflowEvent,
  type WorkflowStep,
} from "cloudflare:workers";
import {
  createAbsence,
  validateInput,
  updatePhase,
  publishPack,
  buildPack,
  detectTopic,
} from "../src/preparation";
import type { AbsenceRecord, LessonPack } from "../src/prep-types";
import {
  researchLesson,
  designLesson,
  lessonVideos,
  type ProviderEnv,
} from "./prep-providers";
export interface PrepEnv extends ProviderEnv {
  ABSENCES: DurableObjectNamespace;
  COVERAGE: DurableObjectNamespace;
  ROOMS: DurableObjectNamespace;
  PREP_JOBS: Workflow<{ id: string; revision: number }>;
}
const json = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
export async function internal(
  env: PrepEnv,
  id: string,
  op: string,
  data?: unknown,
) {
  return env.ABSENCES.get(env.ABSENCES.idFromName(id)).fetch(
    new Request(`https://internal/${op}`, {
      method: data === undefined ? "GET" : "POST",
      headers: { "Content-Type": "application/json" },
      ...(data === undefined ? {} : { body: JSON.stringify(data) }),
    }),
  );
}
export class Preparation extends DurableObject<PrepEnv> {
  async fetch(req: Request) {
    return this.ctx.blockConcurrencyWhile(async () => {
      let record = await this.ctx.storage.get<AbsenceRecord>("record");
      try {
        const url = new URL(req.url),
          op = url.pathname.split("/").at(-1);
        if (
          req.method !== "POST" &&
          !["get", "snapshot", "invitation"].includes(op ?? "")
        )
          return json({ error: "Method not allowed" }, 405);
        let data: any = {};
        if (req.method === "POST") {
          const raw = await req.text();
          if (raw.length > 32000)
            return json({ error: "Request too large" }, 413);
          data = JSON.parse(raw);
        }
        if (op === "create") {
          if (record) return json({ error: "Already exists" }, 409);
          record = createAbsence(data.id, validateInput(data.input));
          await this.ctx.storage.put("record", record);
          return json(
            {
              id: record.id,
              ownerToken: record.ownerToken,
              adminToken: record.adminToken,
              revision: record.revision,
              phase: record.phase,
            },
            201,
          );
        }
        if (!record) return json({ error: "Absence not found" }, 404);
        if (op === "snapshot") return json(record);
        if (op === "update") {
          if (
            record.revision !== data.revision ||
            record.phase === "canceled" ||
            record.phase === "published"
          )
            return json({ stale: true }, 409);
          updatePhase(record, data.revision, data.phase, data.message);
          if (data.pack) record.pack = data.pack;
          if (data.error) record.error = String(data.error).slice(0, 1000);
          else delete record.error;
          await this.ctx.storage.put("record", record);
          return json({ ok: true });
        }
        const auth = req.headers.get("Authorization")?.replace(/^Bearer /, ""),
          owner = auth === record.ownerToken,
          admin = auth === record.adminToken,
          sub = Boolean(record.assigned && auth === record.assigned.token);
        if (op === "invitation") {
          const invitation = record.invitations.find(
            (i) => i.token === (data.token ?? url.searchParams.get("token")),
          );
          if (
            !invitation ||
            invitation.status === "expired" ||
            record.phase === "canceled"
          )
            return json(
              { error: "This invitation is invalid or expired" },
              410,
            );
          if (req.method === "GET")
            return json({
              id: record.id,
              teacher: record.input.teacherLabel,
              school: record.input.schoolLabel,
              date: record.input.date,
              grade: record.input.grade,
              periods: record.input.periods,
              timezone: record.input.timezone,
              label: invitation.label,
              status: record.assigned ? "filled" : "available",
            });
          if (record.assigned) {
            if (record.assigned.id === invitation.substituteId)
              return json({ token: record.assigned.token });
            return json(
              { error: "Another substitute already accepted this assignment." },
              409,
            );
          }
          const reservation = await this.env.COVERAGE.get(
            this.env.COVERAGE.idFromName("coverage"),
          ).fetch(
            new Request("https://internal/reserve", {
              method: "POST",
              body: JSON.stringify({
                id: record.id,
                substituteId: invitation.substituteId,
                date: record.input.date,
                timezone: record.input.timezone,
                periods: record.input.periods,
              }),
            }),
          );
          if (!reservation.ok) return reservation;
          record.assigned = {
            id: invitation.substituteId,
            label: invitation.label,
            token: crypto.randomUUID(),
          };
          invitation.status = "accepted";
          record.invitations
            .filter((i) => i.id !== invitation.id)
            .forEach((i) => (i.status = "expired"));
          record.events.push({
            at: new Date().toISOString(),
            phase: "assigned",
            message: `${invitation.label} accepted all periods.`,
          });
          record.outbox.push({
            id: `${record.revision}:accepted`,
            type: "assignment",
            recipient:
              record.input.administratorEmail || "Administrator workspace",
            subject: `Coverage accepted: ${invitation.label}`,
            text: `${invitation.label} accepted ${record.input.date} at ${record.input.schoolLabel}.`,
            status: record.input.sandbox ? "sandbox" : "awaiting_connection",
            createdAt: new Date().toISOString(),
          });
          await this.ctx.storage.put("record", record);
          return json({ token: record.assigned.token });
        }
        if (!owner && !admin && !sub)
          return json(
            {
              error:
                "Authorized teacher, administrator, or assigned substitute access required.",
            },
            401,
          );
        if (op === "get") {
          const { ownerToken, adminToken, ...view } = record;
          if (!owner && !admin) {
            view.invitations = [];
            view.outbox = [];
            view.input = {
              ...view.input,
              administratorEmail: "",
              substitutes: [],
            };
            view.rooms = Object.fromEntries(
              Object.entries(view.rooms).map(([key, room]) => [
                key,
                { id: room.id, adminToken: room.adminToken },
              ]),
            );
          }
          return json({
            ...view,
            role: owner ? "teacher" : admin ? "administrator" : "substitute",
          });
        }
        if (op === "start") {
          if (record.phase !== "published" || !record.pack)
            throw new Error(
              "Publish a reviewed lesson pack before starting class.",
            );
          const period = record.input.periods.find(
            (p) => p.id === data.periodId,
          );
          if (!period) throw new Error("Choose a valid period.");
          const key = `${record.revision}:${period.id}`;
          if (!record.rooms[key]) {
            const id = crypto.randomUUID();
            const created = await this.env.ROOMS.get(
              this.env.ROOMS.idFromName(id),
            ).fetch(
              new Request("https://internal/create", {
                method: "POST",
                body: JSON.stringify({ pack: record.pack }),
              }),
            );
            if (!created.ok)
              throw new Error("Could not initialize classroom. Please retry.");
            const result = (await created.json()) as { adminToken: string };
            record.rooms[key] = { id, adminToken: result.adminToken };
            await this.ctx.storage.put("record", record);
          }
          return json(record.rooms[key]);
        }
        if (!owner && !admin)
          return json(
            { error: "Teacher or administrator action required" },
            403,
          );
        if (op === "publish") {
          publishPack(record, Boolean(data.reviewed));
          await this.ctx.storage.put("record", record);
          return json({ ok: true });
        }
        if (op === "cancel") {
          record.phase = "canceled";
          record.invitations.forEach((i) => (i.status = "expired"));
          record.events.push({
            at: new Date().toISOString(),
            phase: "canceled",
            message:
              "Absence canceled. Existing room records remain available.",
          });
          await this.ctx.storage.put("record", record);
          await this.env.COVERAGE.get(
            this.env.COVERAGE.idFromName("coverage"),
          ).fetch(
            new Request("https://internal/release", {
              method: "POST",
              body: JSON.stringify({ id: record.id }),
            }),
          );
          return json({ ok: true });
        }
        if (op === "retry" || op === "revise") {
          if (record.phase === "canceled")
            throw new Error(
              "A canceled absence cannot restart. Create a new absence.",
            );
          if (Object.keys(record.rooms).length)
            throw new Error(
              "A classroom already uses this published pack. Create another absence to preserve its version.",
            );
          const fresh = createAbsence(
            record.id,
            op === "revise" ? validateInput(data.input) : record.input,
            record.revision + 1,
          );
          fresh.ownerToken = record.ownerToken;
          fresh.adminToken = record.adminToken;
          fresh.createdAt = record.createdAt;
          fresh.events = [...record.events, ...fresh.events];
          record = fresh;
          await this.ctx.storage.put("record", record);
          await this.env.COVERAGE.get(
            this.env.COVERAGE.idFromName("coverage"),
          ).fetch(
            new Request("https://internal/release", {
              method: "POST",
              body: JSON.stringify({ id: record.id }),
            }),
          );
          return json({ revision: record.revision, phase: record.phase });
        }
        return json({ error: "Not found" }, 404);
      } catch (e) {
        return json(
          { error: e instanceof Error ? e.message : "Invalid request" },
          400,
        );
      }
    });
  }
}
type Reservation = {
  id: string;
  substituteId: string;
  start: number;
  end: number;
};
export function schoolTimestamp(date: string, time: string, timezone: string) {
  const desired = Date.parse(`${date}T${time}:00Z`);
  let guess = desired;
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  for (let i = 0; i < 3; i++) {
    const parts = Object.fromEntries(
      fmt.formatToParts(new Date(guess)).map((p) => [p.type, p.value]),
    );
    const local = Date.parse(
      `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:00Z`,
    );
    guess += desired - local;
  }
  return guess;
}
export class Coverage extends DurableObject<PrepEnv> {
  async fetch(req: Request) {
    return this.ctx.blockConcurrencyWhile(async () => {
      const data = (await req.json()) as any,
        op = new URL(req.url).pathname;
      let rows = (await this.ctx.storage.get<Reservation[]>("rows")) ?? [];
      if (op === "/release") {
        rows = rows.filter((r) => r.id !== data.id);
        await this.ctx.storage.put("rows", rows);
        return json({ ok: true });
      }
      const slots: Reservation[] = data.periods.map((p: any) => ({
        id: data.id,
        substituteId: data.substituteId,
        start: schoolTimestamp(data.date, p.start, data.timezone),
        end: schoolTimestamp(data.date, p.end, data.timezone),
      }));
      if (
        rows.some((row) =>
          slots.some(
            (slot) =>
              row.id !== slot.id &&
              row.substituteId === slot.substituteId &&
              row.start < slot.end &&
              slot.start < row.end,
          ),
        )
      )
        return json(
          { error: "This substitute already has an overlapping assignment." },
          409,
        );
      rows = rows.filter((r) => r.id !== data.id);
      rows.push(...slots);
      await this.ctx.storage.put("rows", rows);
      return json({ ok: true });
    });
  }
}
export class LessonPreparation extends WorkflowEntrypoint<
  PrepEnv,
  { id: string; revision: number }
> {
  async run(
    event: WorkflowEvent<{ id: string; revision: number }>,
    step: WorkflowStep,
  ) {
    const { id, revision } = event.payload;
    const current = async () => {
      const response = await internal(this.env, id, "snapshot");
      return response.json() as Promise<AbsenceRecord>;
    };
    const mark = async (
      phase: string,
      message: string,
      extra: Record<string, unknown> = {},
    ) => {
      const response = await internal(this.env, id, "update", {
        revision,
        phase,
        message,
        ...extra,
      });
      return response.ok;
    };
    try {
      const record = await step.do("load-absence", async () => current());
      if (
        record.revision !== revision ||
        record.phase === "canceled" ||
        record.phase === "unsupported"
      )
        return;
      try {
        detectTopic(record.input);
      } catch (e) {
        await mark("unsupported", (e as Error).message, {
          error: (e as Error).message,
        });
        return;
      }
      const sources = await step.do(
        "state-evidence",
        {
          retries: { limit: 1, delay: "5 seconds", backoff: "constant" },
          timeout: "2 minutes",
        },
        async () => {
          if (
            !(await mark(
              "research",
              "You.com is locating official state standards and reading source pages.",
            ))
          )
            throw new Error("Stale preparation");
          return researchLesson(record, this.env);
        },
      );
      const designed = await step.do(
        "lesson-design",
        {
          retries: { limit: 1, delay: "10 seconds", backoff: "constant" },
          timeout: "3 minutes",
        },
        async () => {
          if (
            !(await mark(
              "design",
              "Designing questions and a substitute guide against the retrieved evidence.",
            ))
          )
            throw new Error("Stale preparation");
          return designLesson(record, sources, this.env);
        },
      );
      const videos = await step.do(
        "video-discovery",
        { timeout: "45 seconds" },
        async () => lessonVideos(record, this.env),
      );
      await step.do("validate-and-save", async () => {
        if (
          !(await mark(
            "validation",
            "Checking exact answers, supported tools, source quotes, and lesson consistency.",
          ))
        )
          return;
        const latest = await current();
        if (latest.revision !== revision || latest.phase === "canceled") return;
        const pack = buildPack(
          record,
          designed.draft,
          sources,
          videos,
          designed.orchestrator,
        );
        await mark(
          pack.validation.alignment ? "ready" : "needs_review",
          pack.validation.alignment
            ? "Lesson pack is ready for adult preview and publication."
            : "Math and tools passed; inspect and confirm state alignment before publication.",
          { pack },
        );
      });
    } catch (error) {
      await step.do("record-failure", async () =>
        mark("failed", "Preparation stopped with an actionable error.", {
          error: error instanceof Error ? error.message : "Preparation failed",
        }),
      );
    }
  }
}
export async function preparationRoutes(
  req: Request,
  env: PrepEnv,
): Promise<Response | undefined> {
  const url = new URL(req.url);
  if (url.pathname === "/api/absences" && req.method === "POST") {
    const raw = await req.text();
    if (raw.length > 32000) return json({ error: "Request too large" }, 413);
    try {
      const input = validateInput(JSON.parse(raw)),
        id = crypto.randomUUID();
      const created = await internal(env, id, "create", { id, input });
      if (!created.ok) return created;
      const result = (await created.json()) as any;
      if (result.phase === "queued")
        await env.PREP_JOBS.create({
          id: `prep-${id}-${result.revision}`,
          params: { id, revision: result.revision },
        });
      return json(result, 201);
    } catch (e) {
      return json(
        { error: e instanceof Error ? e.message : "Invalid absence" },
        400,
      );
    }
  }
  const match = url.pathname.match(
    /^\/api\/absences\/([a-f0-9-]{36})\/(get|publish|cancel|retry|revise|start|invitation)$/,
  );
  if (!match) return undefined;
  const response = await env.ABSENCES.get(
    env.ABSENCES.idFromName(match[1]),
  ).fetch(req);
  if (response.ok && ["retry", "revise"].includes(match[2])) {
    const copy = (await response.clone().json()) as {
      revision: number;
      phase: string;
    };
    if (copy.phase === "queued")
      await env.PREP_JOBS.create({
        id: `prep-${match[1]}-${copy.revision}`,
        params: { id: match[1], revision: copy.revision },
      });
  }
  return response;
}
