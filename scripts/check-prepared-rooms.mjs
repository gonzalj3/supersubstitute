// Run against synthetic prepared records only. Input token files must remain in ignored .tools/.
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
const origin =
  process.env.SMOKE_ORIGIN ??
  "https://understudy-classroom.martin-jose-gonzalez.workers.dev";
const records = JSON.parse(
  await readFile(process.env.PREP_RECORDS ?? ".tools/prep-live.json", "utf8"),
);
async function call(path, body, token) {
  const response = await fetch(origin + path, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: response.status, data: await response.json() };
}
const results = [];
for (const record of records) {
  const base = `/api/absences/${record.id}`;
  assert.equal((await call(base + "/get")).status, 401);
  const { data: prepared } = await call(
    base + "/get",
    undefined,
    record.ownerToken,
  );
  if (!prepared.pack) {
    console.log(
      record.name + ": " + prepared.phase + " (not ready for classroom test)",
    );
    continue;
  }
  assert.equal(
    (await call(base + "/publish", { reviewed: false }, record.ownerToken))
      .status,
    400,
  );
  if (prepared.phase !== "published")
    assert.equal(
      (await call(base + "/publish", { reviewed: true }, record.ownerToken))
        .status,
      200,
    );
  const started = await call(
    base + "/start",
    { periodId: prepared.input.periods[0].id },
    record.ownerToken,
  );
  assert.equal(started.status, 200);
  const room = `/api/rooms/${started.data.id}`,
    token = started.data.adminToken;
  const { data: state } = await call(room + "/room", undefined, token);
  assert.equal(state.items, prepared.pack.items.length);
  assert.equal(state.lesson.packId, prepared.pack.id);
  if (state.phase === "closed") {
    console.log(record.name + ": previously verified classroom is closed");
    continue;
  }
  const { data: seat } = await call(room + "/join", {
    label: "Check " + crypto.randomUUID().slice(0, 6),
  });
  const { data: question } = await call(
    room + `/student?id=${seat.id}`,
    undefined,
    seat.token,
  );
  assert.equal(question.item.prompt, prepared.pack.items[0].prompt);
  assert.equal(question.total, prepared.pack.items.length);
  assert.equal(question.item.answer, undefined);
  assert.equal(question.lesson.grade, prepared.input.grade);
  const answer = await call(room + "/answer", {
    requestId: crypto.randomUUID(),
    studentId: seat.id,
    token: seat.token,
    itemId: question.item.id,
    value: prepared.pack.items[0].answer,
  });
  assert.equal(answer.status, 200);
  assert.equal(answer.data.correct, true);
  const report = await call(room + "/close", {}, token);
  assert.equal(report.status, 200);
  assert.equal(
    report.data.standard,
    `${prepared.pack.state} · ${prepared.pack.standard.code}`,
  );
  results.push({
    case: record.name,
    title: prepared.pack.title,
    questions: prepared.pack.items.length,
    tools: prepared.pack.tools.map((t) => t.kind),
    alignment: prepared.pack.validation.alignment,
    classroom: "passed",
    orchestrator: prepared.pack.orchestrator,
  });
  console.log(
    record.name + ": publish → classroom → student answer → report PASSED",
  );
}
await writeFile(
  ".tools/prepared-room-results.json",
  JSON.stringify(results, null, 2),
);
