// Templates (US5, T130): "save as template" from a project and the workspace's template list.
import "server-only";
import { and, desc, eq, isNull } from "drizzle-orm";
import { templates, withWorkspace } from "@makvid/db";
import { createTemplate } from "@makvid/pipeline";
import { server } from "./deps";
import type { Viewer } from "./session";

export async function listTemplates(workspaceId: string) {
  return withWorkspace(server().db, workspaceId, (tx) =>
    tx
      .select({
        id: templates.id,
        name: templates.name,
        variables: templates.variables,
        projectId: templates.projectId,
        createdAt: templates.createdAt,
      })
      .from(templates)
      .where(isNull(templates.deletedAt))
      .orderBy(desc(templates.createdAt)),
  );
}

export async function getTemplate(workspaceId: string, id: string) {
  const [t] = await withWorkspace(server().db, workspaceId, (tx) =>
    tx
      .select()
      .from(templates)
      .where(and(eq(templates.id, id), isNull(templates.deletedAt))),
  );
  return t ?? null;
}

export function saveAsTemplate(
  v: Viewer,
  projectId: string,
  name: string,
  replacements: Array<{ find: string; name: string }>,
) {
  return createTemplate(server().deps, {
    workspaceId: v.workspaceId,
    userId: v.userId,
    projectId,
    name,
    replacements,
  });
}
