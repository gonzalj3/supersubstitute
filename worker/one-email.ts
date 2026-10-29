import type { AbsenceRecord, OutboxMessage } from "../src/prep-types";
export type OneEmailEnv = {
  ONE_API_KEY?: string;
  ONE_GMAIL_CONNECTION_KEY?: string;
  ONE_GMAIL_ACTION_ID?: string;
};
const site = "https://understudy-classroom.martin-jose-gonzalez.workers.dev";
function messageBody(record: AbsenceRecord, message: OutboxMessage) {
  let link = `${site}/coverage?id=${record.id}&access=${record.adminToken}`;
  if (message.type === "invitation") {
    const invitation = record.invitations.find(
      (i) => message.id === `${record.revision}:invite:${i.substituteId}`,
    );
    if (
      !invitation ||
      invitation.status !== "invited" ||
      record.phase === "canceled"
    )
      throw new Error("Invitation expired");
    link = `${site}/invitation?id=${record.id}&token=${invitation.token}`;
  } else if (message.type === "pack-ready" && record.assigned) {
    link = `${site}/substitute?id=${record.id}&access=${record.assigned.token}`;
  }
  return `${message.text}\n\nOpen SuperSubstitute: ${link}\n\nThis private access link is intended for the named recipient.\nSent by SuperSubstitute through One and Gmail.`;
}
export async function deliverOutbox(
  record: AbsenceRecord,
  env: OneEmailEnv,
  save: () => Promise<void>,
  fetcher: typeof fetch = fetch,
) {
  if (record.input.sandbox)
    throw new Error(
      "Sandbox notifications cannot be sent. Create a day with sandbox notifications unchecked.",
    );
  if (
    !env.ONE_API_KEY ||
    !env.ONE_GMAIL_CONNECTION_KEY ||
    !env.ONE_GMAIL_ACTION_ID
  )
    throw new Error("One Gmail delivery is not configured.");
  let sent = 0;
  for (const message of record.outbox) {
    if (
      message.status !== "awaiting_connection" ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(message.recipient)
    )
      continue;
    if (record.phase === "canceled" && message.type !== "cancellation")
      continue;
    let body: string;
    try {
      body = messageBody(record, message);
    } catch {
      continue;
    }
    message.status = "sending";
    await save(); // Persist before the external side effect. Interrupted sends require mailbox reconciliation.
    try {
      const response = await fetcher(
        "https://api.withone.ai/v1/passthrough/v1/gmail/send-email",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-one-secret": env.ONE_API_KEY,
            "x-one-connection-key": env.ONE_GMAIL_CONNECTION_KEY,
            "x-one-action-id": env.ONE_GMAIL_ACTION_ID,
            "x-one-source": "supersubstitute",
          },
          body: JSON.stringify({
            connectionKey: env.ONE_GMAIL_CONNECTION_KEY,
            to: message.recipient,
            subject: message.subject,
            body,
          }),
          signal: AbortSignal.timeout(20000),
        },
      );
      const data = (await response.json()) as {
        email?: { sent?: boolean; messageId?: string };
      };
      if (!response.ok || !data.email?.sent || !data.email.messageId)
        throw new Error("Delivery not confirmed");
      message.status = "sent";
      message.providerId = data.email.messageId;
      message.sentAt = new Date().toISOString();
      sent++;
    } catch {
      message.status = "unknown";
    }
    await save();
  }
  return {
    sent,
    unknown: record.outbox.filter(
      (m) => m.status === "unknown" || m.status === "sending",
    ).length,
  };
}
