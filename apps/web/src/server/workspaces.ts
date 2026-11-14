// Workspaces of the signed-in user with names, for the switcher and the shell.
import "server-only";
import { inArray } from "drizzle-orm";
import { withUser, workspaces } from "@makvid/db";
import { server } from "./deps";
import type { Viewer } from "./session";

export interface WorkspaceItem {
  id: string;
  name: string;
  role: string;
  current: boolean;
}

export async function listWorkspaces(v: Viewer): Promise<WorkspaceItem[]> {
  const ids = v.workspaces.map((w) => w.id);
  const rows = await withUser(server().db, v.userId, (tx) =>
    tx.select({ id: workspaces.id, name: workspaces.name }).from(workspaces).where(inArray(workspaces.id, ids)),
  );
  return v.workspaces.map((w) => ({
    id: w.id,
    name: rows.find((r) => r.id === w.id)?.name ?? w.id.slice(0, 8),
    role: w.role,
    current: w.id === v.workspaceId,
  }));
}
