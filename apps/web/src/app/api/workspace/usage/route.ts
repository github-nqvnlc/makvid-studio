// GET: plan, usage this period, credits (usage meters).
import { usageSummary } from "@makvid/billing";
import { guarded } from "@/server/api";
import { server } from "@/server/deps";

export const dynamic = "force-dynamic";

export function GET() {
  return guarded("GET /api/workspace/usage", async (v) =>
    Response.json(await usageSummary(server().db, v.workspaceId)),
  );
}
