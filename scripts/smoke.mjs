// Exercise the actual Worker + Durable Object over HTTP. No provider keys needed.
import assert from "node:assert/strict";
const origin = process.env.SMOKE_ORIGIN ?? "http://localhost:8787";
async function call(path, body, token) {
  const res = await fetch(origin + path, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: res.status, data: await res.json() };
}
assert.equal((await call("/api/health")).data.ok, true);
const created = await call("/api/rooms", {});
assert.equal(created.status, 201);
const { id, adminToken } = created.data,
  base = `/api/rooms/${id}`;
assert.equal((await call(`${base}/room`)).status, 401);
assert.equal(
  (await call(`${base}/videos`, { topic: "equivalent fractions" })).status,
  401,
);
assert.equal(
  (await call(`${base}/videos`, { topic: "" }, adminToken)).status,
  400,
);
const videos = await call(
  `${base}/videos`,
  { topic: "equivalent fractions" },
  adminToken,
);
assert.ok([200, 503].includes(videos.status));
const { data: seat } = await call(`${base}/join`, { label: "Smoke Seat" });
assert.ok(seat.token);
const { data: current } = await call(
  `${base}/student?id=${seat.id}`,
  undefined,
  seat.token,
);
assert.equal(current.item.prompt, "2 1/3 + 1 3/4");
assert.equal(current.item.answer, undefined);
const input = {
  requestId: "smoke-once",
  studentId: seat.id,
  token: seat.token,
  itemId: current.item.id,
  value: "3 4/7",
};
const [a, b] = await Promise.all([
  call(`${base}/answer`, input),
  call(`${base}/answer`, input),
]);
assert.equal(a.status, 200);
assert.deepEqual(a.data, b.data);
assert.equal(a.data.correct, false);
assert.equal(
  (await call(`${base}/room`, undefined, adminToken)).data.attempts,
  1,
);
assert.equal(
  (await call(`${base}/answer`, { ...input, value: "49/12" })).status,
  400,
);
assert.equal(
  (
    await call(`${base}/answer`, {
      ...input,
      requestId: "smoke-correct",
      value: "4 1/12",
    })
  ).data.correct,
  true,
);
assert.equal(
  (await call(`${base}/simulate`, {}, adminToken)).data.students.filter(
    (s) => s.simulated,
  ).length,
  6,
);
const note = {
  requestId: "message-once",
  studentId: seat.id,
  token: seat.token,
  text: "Please help me find equivalent fractions.",
};
assert.equal(
  (await call(`${base}/message`, { ...note, token: "wrong" })).status,
  400,
);
const delivered = await call(`${base}/message`, note);
assert.equal(delivered.status, 200);
assert.deepEqual((await call(`${base}/message`, note)).data, delivered.data);
assert.equal(
  (await call(`${base}/room`, undefined, adminToken)).data.messages.length,
  1,
);
assert.equal(
  (await call(`${base}/tutor`, { ...note, token: "wrong" })).status,
  400,
);
if (!current.tutorAvailable)
  assert.equal((await call(`${base}/tutor`, note)).status, 503);
const closed = await call(`${base}/close`, {}, adminToken);
assert.equal(closed.status, 200);
assert.equal(closed.data.messages[0].text, note.text);
assert.deepEqual(
  (await call(`${base}/close`, {}, adminToken)).data,
  closed.data,
);
assert.equal((await call(`${base}/join`, { label: "Late Seat" })).status, 400);
assert.equal(
  (
    await call(`${base}/answer`, {
      ...input,
      requestId: "late",
      itemId: "fraction-add",
    })
  ).status,
  400,
);
assert.equal(
  (await call(`${base}/room`, undefined, adminToken)).data.phase,
  "closed",
);
console.log(
  `Worker smoke passed: persistence, concurrent deduplication, isolation, simulation, close, frozen handoff (${origin}).`,
);
