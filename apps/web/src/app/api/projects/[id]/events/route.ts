// Server-sent progress events (T101): project status + a friendly progress sentence, pushed when they
// change. Only message keys mapped to localized text are sent: never raw job errors.
import { latestProgress, listEvents, progressText, runEvents, stageStates } from "@makvid/pipeline";
import { guarded, projectId } from "@/server/api";
import { server } from "@/server/deps";

export const dynamic = "force-dynamic";

export function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return guarded("GET /api/projects/[id]/events", async (v) => {
    const id = projectId((await ctx.params).id);
    const locale = new URL(req.url).searchParams.get("locale") === "en" ? "en" : "vi";
    const enc = new TextEncoder();
    // Log entries resume after the last one the browser saw (Last-Event-ID) or the cursor of its history fetch.
    const resume = Number(req.headers.get("last-event-id") ?? new URL(req.url).searchParams.get("after") ?? 0);
    let timer: ReturnType<typeof setInterval> | undefined;
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        let last = "";
        let ticks = 0;
        let lastSeq = Number.isFinite(resume) && resume > 0 ? resume : 0;
        let lastStages = "";
        let running = false; // a slow poll must not overlap the next one (it would repeat log entries)
        const tick = async () => {
          if (running) return;
          running = true;
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
            // Activity log: new entries (ordered, id = seq) and the state of every stage when it changes.
            const { db } = server();
            for (;;) {
              const page = await listEvents(db, v.workspaceId, id, { after: lastSeq, limit: 200, locale });
              for (const e of page.entries) {
                controller.enqueue(enc.encode(`id: ${e.seq}\nevent: log\ndata: ${JSON.stringify(e)}\n\n`));
                lastSeq = e.seq;
              }
              if (!page.hasMore) break;
            }
            const stages = JSON.stringify(stageStates(await runEvents(db, v.workspaceId, id), p.status));
            if (stages !== lastStages) {
              lastStages = stages;
              controller.enqueue(enc.encode(`event: stages\ndata: ${stages}\n\n`));
            }
          } catch {
            // transient DB hiccup: try again on the next tick
          } finally {
            running = false;
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
