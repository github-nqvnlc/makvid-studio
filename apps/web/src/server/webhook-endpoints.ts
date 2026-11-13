// Workspace webhook endpoints (US7): the signing secret is shown once at creation and stored encrypted.
import "server-only";
import { eq } from "drizzle-orm";
import { webhookDeliveries, webhookEndpoints, withWorkspace } from "@makvid/db";
import {
  encryptSecret,
  newWebhookSecret,
  ProjectError,
  WEBHOOK_EVENTS,
  type WebhookEvent,
} from "@makvid/pipeline";
import { server } from "./deps";

export async function listWebhooks(workspaceId: string) {
  return withWorkspace(server().db, workspaceId, async (tx) => {
    const eps = await tx
      .select({
        id: webhookEndpoints.id,
        url: webhookEndpoints.url,
        events: webhookEndpoints.events,
        createdAt: webhookEndpoints.createdAt,
      })
      .from(webhookEndpoints)
      .where(eq(webhookEndpoints.active, true));
    const recent = await tx
      .select({
        endpointId: webhookDeliveries.endpointId,
        event: webhookDeliveries.event,
        status: webhookDeliveries.status,
        attempts: webhookDeliveries.attempts,
        lastHttpStatus: webhookDeliveries.lastHttpStatus,
        createdAt: webhookDeliveries.createdAt,
      })
      .from(webhookDeliveries)
      .orderBy(webhookDeliveries.createdAt)
      .limit(50);
    return eps.map((e) => ({ ...e, deliveries: recent.filter((d) => d.endpointId === e.id).slice(-10) }));
  });
}

export async function addWebhook(workspaceId: string, url: string, events: WebhookEvent[]) {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    throw new ProjectError("invalid");
  }
  // Production endpoints must use HTTPS; plain HTTP only for local development.
  if (u.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && u.protocol === "http:"))
    throw new ProjectError("invalid");
  if (u.username || u.password || url.length > 2000) throw new ProjectError("invalid");
  const evs = events.filter((e) => (WEBHOOK_EVENTS as readonly string[]).includes(e));
  if (!evs.length) throw new ProjectError("invalid");
  const secret = newWebhookSecret();
  const [row] = await withWorkspace(server().db, workspaceId, (tx) =>
    tx
      .insert(webhookEndpoints)
      .values({ workspaceId, url: u.toString(), secretEnc: encryptSecret(secret), events: evs })
      .returning({ id: webhookEndpoints.id }),
  );
  return { id: row!.id, secret };
}

export async function removeWebhook(workspaceId: string, id: string) {
  await withWorkspace(server().db, workspaceId, (tx) =>
    tx.update(webhookEndpoints).set({ active: false }).where(eq(webhookEndpoints.id, id)),
  );
}
