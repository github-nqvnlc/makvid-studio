// Current user + workspace for server components and route handlers.
import "server-only";
import { headers } from "next/headers";
import { memberships, withUser } from "@makvid/db";
import { auth } from "./auth";
import { server } from "./deps";

export interface Viewer {
  userId: string;
  name: string;
  email: string;
  workspaceId: string;
}

export async function viewer(): Promise<Viewer | null> {
  const s = await auth().api.getSession({ headers: await headers() });
  if (!s) return null;
  const [m] = await withUser(server().db, s.user.id, (tx) => tx.select().from(memberships).limit(1));
  if (!m) return null;
  return { userId: s.user.id, name: s.user.name, email: s.user.email, workspaceId: m.workspaceId };
}
