// DELETE: revoke a pending invitation.
import { guarded, uuidParam } from "@/server/api";
import { revokeInvitation } from "@/server/members";

export function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return guarded("DELETE /api/workspace/invitations/[id]", async (v) => {
    await revokeInvitation(v, uuidParam((await params).id));
    return Response.json({ ok: true });
  });
}
