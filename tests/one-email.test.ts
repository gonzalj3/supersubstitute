import { describe, it, expect, vi } from "vitest";
import { deliverOutbox } from "../worker/one-email";
import { createAbsence, validateInput } from "../src/preparation";
function record(sandbox = false) {
  return createAbsence(
    "demo",
    validateInput({
      teacherLabel: "Demo teacher",
      schoolLabel: "Demo school",
      date: "2026-10-29",
      grade: 5,
      timezone: "America/Los_Angeles",
      topic: "fractions-add",
      state: "CA",
      objective: "Add mixed numbers",
      administratorEmail: "owner@example.com",
      sandbox,
      periods: [{ id: "math", label: "Math", start: "09:00", end: "09:45" }],
      substitutes: [],
    }),
  );
}
const env = {
  ONE_API_KEY: "secret",
  ONE_GMAIL_CONNECTION_KEY: "connection",
  ONE_GMAIL_ACTION_ID: "discovered-action",
};
describe("One email delivery", () => {
  it("never sends sandbox messages or messages without an email recipient", async () => {
    const fetcher = vi.fn();
    const save = vi.fn();
    const r = record(true);
    await expect(deliverOutbox(r, env, save, fetcher)).rejects.toThrow(
      /Sandbox/,
    );
    r.input.sandbox = false;
    r.outbox[0].status = "awaiting_connection";
    r.outbox[0].recipient = "Administrator workspace";
    await deliverOutbox(r, env, save, fetcher);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("checkpoints before sending and skips delivered messages on repeated clicks", async () => {
    const r = record();
    const checkpoints: string[] = [];
    const save = async () => {
      checkpoints.push(r.outbox[0].status);
    };
    const fetcher = vi.fn(
      async (_url: string | URL | Request, _init?: RequestInit) => {
        expect(checkpoints).toContain("sending");
        return Response.json({ email: { sent: true, messageId: "gmail-id" } });
      },
    );
    await deliverOutbox(r, env, save, fetcher);
    await deliverOutbox(r, env, save, fetcher);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(r.outbox[0].status).toBe("sent");
    expect(r.outbox[0].providerId).toBe("gmail-id");
    const body = JSON.parse(fetcher.mock.calls[0][1]!.body as string);
    expect(body.body).toContain("/coverage?id=demo&access=");
  });
  it("never blindly retries an ambiguous send failure", async () => {
    const r = record();
    const fetcher = vi.fn().mockRejectedValue(new Error("timeout"));
    await deliverOutbox(r, env, async () => {}, fetcher);
    await deliverOutbox(r, env, async () => {}, fetcher);
    expect(r.outbox[0].status).toBe("unknown");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});

it("automatic report delivery sends only reports and honors explicit report settings", async () => {
  const r = record(true);
  r.reportDelivery = {
    teacherEmail: "owner@example.com",
    administratorEmail: "",
    enabled: true,
  };
  r.outbox.push({
    id: "day",
    type: "day-report",
    recipient: "owner@example.com",
    subject: "Day summary",
    text: "Recorded progress",
    status: "awaiting_connection",
    createdAt: new Date().toISOString(),
  });
  const fetcher = vi
    .fn()
    .mockResolvedValue(
      Response.json({ email: { sent: true, messageId: "report-id" } }),
    );
  await deliverOutbox(r, env, async () => {}, fetcher, "day-report");
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(r.outbox[0].status).toBe("sandbox");
  expect(r.outbox[1].status).toBe("sent");
  r.reportDelivery.enabled = false;
  await expect(
    deliverOutbox(r, env, async () => {}, fetcher, "day-report"),
  ).rejects.toThrow(/Sandbox/);
});
