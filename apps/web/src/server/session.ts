// Current user + workspace for server components and route handlers. A user may belong to several
// workspaces (invitations); the chosen one is kept in a cookie and must still be one of their memberships.
import "server-only";
import { cookies, headers } from "next/headers";
import { asc } from "drizzle-orm";
import { memberships, users, withUser, type Role } from "@makvid/db";
import { eq } from "drizzle-orm";
import { auth } from "./auth";
import { server } from "./deps";

export const WORKSPACE_COOKIE = "mkv_ws";

export interface Viewer {
  userId: string;
  name: string;
  email: string;
  workspaceId: string;
  role: Role;
  isPlatformAdmin: boolean;
  workspaces: Array<{ id: string; role: Role }>;
}

export async function viewer(): Promise<Viewer | null> {
  const s = await auth().api.getSession({ headers: await headers() });
  if (!s) return null;
  const { db } = server();
  const ms = await withUser(db, s.user.id, (tx) =>
    tx.select().from(memberships).orderBy(asc(memberships.createdAt)),
  );
  if (!ms.length) return null;
  const wanted = (await cookies()).get(WORKSPACE_COOKIE)?.value;
  const m = ms.find((x) => x.workspaceId === wanted) ?? ms[0]!;
  const [u] = await db.select({ admin: users.isPlatformAdmin }).from(users).where(eq(users.id, s.user.id));
  return {
    userId: s.user.id,
    name: s.user.name,
    email: s.user.email,
    workspaceId: m.workspaceId,
    role: m.role,
    isPlatformAdmin: u?.admin === true,
    workspaces: ms.map((x) => ({ id: x.workspaceId, role: x.role })),
  };
}
