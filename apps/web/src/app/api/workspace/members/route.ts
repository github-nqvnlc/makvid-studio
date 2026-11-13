// GET: members + pending invitations of the current workspace.
import { guarded } from "@/server/api";
import { listMembers } from "@/server/members";

export const dynamic = "force-dynamic";

export function GET() {
  return guarded("GET /api/workspace/members", async (v) => Response.json(await listMembers(v.workspaceId)));
}
