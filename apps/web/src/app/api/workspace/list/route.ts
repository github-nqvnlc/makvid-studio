// GET: the user's workspaces (id, name, role, current) for the switcher.
import { guarded } from "@/server/api";
import { listWorkspaces } from "@/server/workspaces";

export const dynamic = "force-dynamic";

export function GET() {
  return guarded("GET /api/workspace/list", async (v) => Response.json({ workspaces: await listWorkspaces(v) }));
}
