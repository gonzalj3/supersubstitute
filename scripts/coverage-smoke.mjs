import assert from "node:assert/strict";
const origin = process.env.SMOKE_ORIGIN ?? "http://localhost:8787";
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
const run = crypto.randomUUID().slice(0, 8);
async function create(timezone, start, end, substitutes) {
  const result = await call("/api/absences", {
    teacherLabel: "Synthetic coverage check",
    schoolLabel: "Synthetic school",
    date: "2026-12-01",
    timezone,
    grade: 8,
    state: "CA",
    topic: "auto",
    objective:
      "Unsupported algebra case: coverage must still work without generation.",
    periods: [{ id: "p1", label: "Math", start, end }],
    substitutes: substitutes.map((id) => ({
      id,
      label: id,
      email: "",
      available: true,
      grades: [8],
    })),
    sandbox: true,
  });
  assert.equal(result.status, 201);
  assert.equal(result.data.phase, "unsupported");
  return result.data;
}
const a = await create("America/Los_Angeles", "09:00", "09:45", [
    `a-${run}`,
    `b-${run}`,
  ]),
  baseA = `/api/absences/${a.id}`;
assert.equal((await call(baseA + "/get")).status, 401);
assert.equal(
  (await call(baseA + "/cancel", undefined, a.ownerToken)).status,
  405,
);
const { data: record } = await call(baseA + "/get", undefined, a.ownerToken);
assert.equal((await call(baseA + "/send-notices", {}, a.ownerToken)).status, 400);
assert.equal((await call(baseA + "/send-notices", {})).status, 401);
assert.equal(record.outbox.length, 3);
assert.ok(record.outbox.every((m) => m.status === "sandbox"));
const accepts = await Promise.all(
  record.invitations.map((i) =>
    call(baseA + "/invitation", { token: i.token }),
  ),
);
assert.equal(accepts.filter((r) => r.status === 200).length, 1);
const winningIndex = accepts.findIndex((r) => r.status === 200),
  winner = record.invitations[winningIndex];
assert.equal(
  (await call(baseA + "/invitation", { token: winner.token })).status,
  200,
);
const b = await create("America/New_York", "12:15", "13:00", [
    winner.substituteId,
  ]),
  baseB = `/api/absences/${b.id}`;
const { data: other } = await call(baseB + "/get", undefined, b.ownerToken);
assert.equal(
  (await call(baseB + "/invitation", { token: other.invitations[0].token }))
    .status,
  409,
);
assert.equal((await call(baseA + "/cancel", {}, a.ownerToken)).status, 200);
assert.equal(
  (await call(baseA + "/invitation", { token: winner.token })).status,
  410,
);
assert.equal(
  (await call(baseB + "/invitation", { token: other.invitations[0].token }))
    .status,
  200,
);
assert.equal((await call(baseB + "/cancel", {}, b.ownerToken)).status, 200);
console.log(
  "Coverage smoke passed: sandbox outbox, atomic acceptance, idempotency, cross-timezone overlap, cancellation, and release. No provider calls or emails.",
);
