// Server-sent progress events (T101): project status + a friendly progress sentence, pushed when they
// change. Only message keys mapped to localized text are sent: never raw job errors.
import { latestProgress, progressText } from "@makvid/pipeline";
import { guarded, projectId } from "@/server/api";
import { server } from "@/server/deps";

export const dynamic = "force-dynamic";

export function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return guarded("GET /api/projects/[id]/events", async (v) => {
    const id = projectId((await ctx.params).id);
    const locale = new URL(req.url).searchParams.get("locale") === "en" ? "en" : "vi";
    const enc = new TextEncoder();
    let timer: ReturnType<typeof setInterval> | undefined;
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        let last = "";
        let ticks = 0;
        const tick = async () => {
          try {
            const p = await latestProgress(server().db, v.workspaceId, id);
            if (!p) return;
            const event = {
              status: p.status,
              title: p.title,
              headVersionId: p.headVersionId,
              text: p.key ? progressText(p.key, p.params, locale) : null,
              fraction: Math.round(p.fraction * 100) / 100,
            };
            const json = JSON.stringify(event);
            if (json !== last) {
              last = json;
              controller.enqueue(enc.encode(`data: ${json}\n\n`));
            } else if (++ticks % 15 === 0) controller.enqueue(enc.encode(": ping\n\n"));
          } catch {
            // transient DB hiccup: try again on the next tick
          }
        };
        void tick();
        timer = setInterval(() => void tick(), 1000);
        req.signal.addEventListener("abort", () => {
          clearInterval(timer);
          try {
            controller.close();
          } catch {
            // already closed
          }
        });
      },
      cancel() {
        clearInterval(timer);
      },
    });
    return new Response(stream, {
      headers: {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-cache, no-transform",
        connection: "keep-alive",
      },
    });
  });
}
