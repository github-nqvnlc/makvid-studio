// Members and invitations (US6, T142). Invitations are links with a random token; only its sha256 is stored.
// Accepting needs the signed-in user's email to match the invited address.
import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import {
  invitations,
  memberships,
  users,
  withService,
  withWorkspace,
  workspaces,
  type Role,
} from "@makvid/db";
import { ProjectError } from "@makvid/pipeline";
import { assignableRoles } from "./rbac";
import { server } from "./deps";
import type { Viewer } from "./session";

const INVITE_DAYS = 7;
const sha = (s: string) => createHash("sha256").update(s).digest("hex");

export async function listMembers(workspaceId: string) {
  const { db } = server();
  return withWorkspace(db, workspaceId, async (tx) => {
    const ms = await tx
      .select({ userId: memberships.userId, role: memberships.role, createdAt: memberships.createdAt })
      .from(memberships)
      .where(eq(memberships.workspaceId, workspaceId))
      .orderBy(asc(memberships.createdAt));
    const us = ms.length
      ? await tx
          .select({ id: users.id, email: users.email, name: users.name })
          .from(users)
          .where(
            inArray(
              users.id,
              ms.map((m) => m.userId),
            ),
          )
      : [];
    const pending = await tx
      .select()
      .from(invitations)
      .where(
        and(
          eq(invitations.workspaceId, workspaceId),
          isNull(invitations.acceptedAt),
          isNull(invitations.revokedAt),
        ),
      )
      .orderBy(asc(invitations.createdAt));
    return {
      members: ms.map((m) => {
        const u = us.find((x) => x.id === m.userId);
        return { userId: m.userId, role: m.role, email: u?.email ?? "", name: u?.name ?? null };
      }),
      invitations: pending
        .filter((i) => i.expiresAt > new Date())
        .map((i) => ({ id: i.id, email: i.email, role: i.role, expiresAt: i.expiresAt })),
    };
  });
}

/** Create an invitation; returns the one-time token for the link (shown once to the inviter). */
export async function invite(v: Viewer, email: string, role: Role): Promise<{ id: string; token: string }> {
  if (!assignableRoles(v.role).includes(role)) throw new ProjectError("invalid");
  const clean = email.normalize("NFC").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean) || clean.length > 254) throw new ProjectError("invalid");
  const token = randomBytes(24).toString("base64url");
  const [row] = await withWorkspace(server().db, v.workspaceId, (tx) =>
    tx
      .insert(invitations)
      .values({
        workspaceId: v.workspaceId,
        email: clean,
        role,
        tokenHash: sha(token),
        invitedBy: v.userId,
        expiresAt: new Date(Date.now() + INVITE_DAYS * 86400_000),
      })
      .returning({ id: invitations.id }),
  );
  return { id: row!.id, token };
}

export async function revokeInvitation(v: Viewer, id: string) {
  await withWorkspace(server().db, v.workspaceId, (tx) =>
    tx.update(invitations).set({ revokedAt: new Date() }).where(eq(invitations.id, id)),
  );
}

/** Invitation details for the accept page (no secrets). */
export async function invitationInfo(token: string) {
  return withService(server().db, async (tx) => {
    const [i] = await tx
      .select()
      .from(invitations)
      .where(eq(invitations.tokenHash, sha(token)));
    if (!i || i.acceptedAt || i.revokedAt || i.expiresAt < new Date()) return null;
    const [w] = await tx
      .select({ name: workspaces.name })
      .from(workspaces)
      .where(eq(workspaces.id, i.workspaceId));
    return { workspaceId: i.workspaceId, workspaceName: w?.name ?? "", email: i.email, role: i.role };
  });
}

export type AcceptResult = "accepted" | "invalid" | "email_mismatch";

export async function acceptInvitation(token: string, userId: string, email: string): Promise<AcceptResult> {
  return withService(server().db, async (tx) => {
    const [i] = await tx
      .select()
      .from(invitations)
      .where(eq(invitations.tokenHash, sha(token)));
    if (!i || i.acceptedAt || i.revokedAt || i.expiresAt < new Date()) return "invalid";
    if (i.email !== email.trim().toLowerCase()) return "email_mismatch";
    await tx
      .insert(memberships)
      .values({ workspaceId: i.workspaceId, userId, role: i.role })
      .onConflictDoNothing();
    await tx.update(invitations).set({ acceptedAt: new Date() }).where(eq(invitations.id, i.id));
    return "accepted";
  });
}

/** Change a member's role. Owners cannot be changed or removed here; you cannot change yourself. */
export async function setRole(v: Viewer, userId: string, role: Role) {
  if (userId === v.userId || !assignableRoles(v.role).includes(role)) throw new ProjectError("invalid");
  await withWorkspace(server().db, v.workspaceId, async (tx) => {
    const [m] = await tx.select().from(memberships).where(eq(memberships.userId, userId));
    if (!m) throw new ProjectError("not_found");
    if (m.role === "owner" || !assignableRoles(v.role).includes(m.role)) throw new ProjectError("invalid");
    await tx.update(memberships).set({ role }).where(eq(memberships.id, m.id));
  });
}

export async function removeMember(v: Viewer, userId: string) {
  await withWorkspace(server().db, v.workspaceId, async (tx) => {
    const [m] = await tx.select().from(memberships).where(eq(memberships.userId, userId));
    if (!m) throw new ProjectError("not_found");
    // Anyone may leave (except the owner); otherwise only roles you could assign may be removed.
    const self = userId === v.userId;
    if (m.role === "owner" || (!self && !assignableRoles(v.role).includes(m.role)))
      throw new ProjectError("invalid");
    await tx.delete(memberships).where(eq(memberships.id, m.id));
  });
}
