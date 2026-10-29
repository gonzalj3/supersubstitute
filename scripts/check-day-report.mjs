// Use only synthetic prepared records. Never enables external email delivery.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const origin =
  process.env.SMOKE_ORIGIN ??
  "https://understudy-classroom.martin-jose-gonzalez.workers.dev";
const records = JSON.parse(
  await readFile(process.env.PREP_RECORDS ?? ".tools/prep-live.json", "utf8"),
);
const record = records[0];
const base = `/api/absences/${record.id}`;
async function call(path, body, token) {
  const r = await fetch(origin + path, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: r.status, data: await r.json() };
}
const settings = {
  teacherEmail: "teacher@example.com",
  administratorEmail: "admin@example.com",
  enabled: false,
};
assert.equal((await call(base + "/report-settings", settings)).status, 401);
assert.equal(
  (await call(base + "/report-settings", settings, record.ownerToken)).status,
  200,
);
const state = (await call(base + "/get", undefined, record.ownerToken)).data;
assert.equal(state.phase, "published");
const started = await call(
  base + "/start",
  { periodId: state.input.periods[0].id },
  record.ownerToken,
);
assert.equal(started.status, 200);
const room = `/api/rooms/${started.data.id}`;
assert.equal(
  (await call(room + "/close", {}, started.data.adminToken)).status,
  200,
);
let completed;
for (let i = 0; i < 15; i++) {
  const r = (await call(base + "/get", undefined, record.ownerToken)).data;
  if (Object.keys(r.periodReports ?? {}).length === r.input.periods.length) {
    completed = r;
    break;
  }
  await new Promise((resolve) => setTimeout(resolve, 1000));
}
assert.ok(
  completed,
  "Durable alarm must post the frozen period report back to the absence",
);
let reports = completed.outbox.filter((m) => m.type === "day-report");
assert.equal(reports.length, 2);
assert.ok(reports.every((m) => m.status === "sandbox"));
assert.ok(
  reports[0].text.includes("End-of-day") ||
    reports[0].text.includes("day summary"),
);
assert.ok(reports[0].text.includes("Correct responses"));
await call(room + "/close", {}, started.data.adminToken);
await new Promise((resolve) => setTimeout(resolve, 1500));
const final = (await call(base + "/get", undefined, record.ownerToken)).data;
reports = final.outbox.filter((m) => m.type === "day-report");
assert.equal(reports.length, 2);
const roomState = (
  await call(room + "/room", undefined, started.data.adminToken)
).data;
assert.match(roomState.report.delivery, /sandbox/i);
console.log(
  "Day report smoke passed: authenticated settings, frozen classroom-to-day callback, teacher/admin outbox, sandbox isolation, repeated-close deduplication. No emails sent.",
);
