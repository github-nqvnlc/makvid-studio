// Video creation and status shared by the public API (US7): ingest the source, reserve quota, start
// production; and the API view of a project (status / progress / outputs / signed downloads).
import "server-only";
import { eq } from "drizzle-orm";
import { attachReservation, reserve, settle } from "@makvid/billing";
import { projects, renderOutputs, withWorkspace } from "@makvid/db";
import { ingestArticle, ingestScript, SafeFetchError, type SourceMaterial } from "@makvid/media";
import { createProject, latestProgress, ProjectError } from "@makvid/pipeline";
import type { AspectRatio } from "@makvid/spec";
import { voiceCatalog } from "@makvid/tts";
import { server } from "./deps";

export interface NewVideo {
  source: { prompt: string } | { script: string } | { url: string };
  aspects: AspectRatio[];
  durationSec: number;
  styleId?: string;
  voiceId?: string;
}

export class SourceError extends Error {
  constructor(readonly code: "source_unreachable" | "source_unreadable") {
    super(code);
  }
}

export async function startVideo(workspaceId: string, userId: string | null, n: NewVideo): Promise<string> {
  const voiceId = n.voiceId ?? voiceCatalog()[0]?.id ?? "vits:banmai";
  if (!voiceCatalog().some((v) => v.id === voiceId)) throw new ProjectError("invalid");
  let source: SourceMaterial | undefined;
  let label: string;
  try {
    if ("prompt" in n.source) label = n.source.prompt;
    else if ("script" in n.source) {
      source = ingestScript(n.source.script);
      label = source.sentences?.[0] ?? "Video";
    } else {
      source = await ingestArticle(n.source.url);
      label = source.title || n.source.url;
    }
  } catch (e) {
    if (e instanceof SafeFetchError) throw new SourceError("source_unreachable");
    throw new SourceError("source_unreadable");
  }
  const words = "script" in n.source ? n.source.script : (source?.markdown ?? "");
  const r = await reserve(server().db, workspaceId, {
    videoSeconds: n.durationSec,
    ttsChars: Math.min([...words].length || n.durationSec * 15, n.durationSec * 25),
    feature: "api",
  });
  try {
    return await createProject(server().deps, {
      workspaceId,
      userId,
      prompt: [...label.normalize("NFC").trim()].slice(0, 200).join("") || "Video",
      aspects: n.aspects,
      durationSec: Math.min(600, Math.max(30, n.durationSec)),
      mode: "auto",
      voiceId,
      ...(n.styleId ? { styleId: n.styleId } : {}),
      ...(source ? { source } : {}),
      onCreated: (pid) => attachReservation(server().db, workspaceId, r.id, pid),
    });
  } catch (e) {
    await settle(server().db, workspaceId, { reservationId: r.id }, false);
    throw e;
  }
}

const API_STATUS = (s: string) =>
  s === "ready" || s === "needs_attention" || s === "failed" ? s : s === "draft" ? "queued" : "processing";

const API_MESSAGE: Record<string, string> = {
  queued: "Waiting to start.",
  processing: "The video is being produced.",
  ready: "The video is ready.",
  needs_attention: "The video is ready but some scenes may need a look.",
  failed: "The video could not be produced. Please try again.",
};

/** Contract `Video`. null when the project does not exist in this workspace. */
export async function videoView(workspaceId: string, id: string) {
  const p = await latestProgress(server().db, workspaceId, id);
  if (!p) return null;
  const outs = p.headVersionId
    ? await withWorkspace(server().db, workspaceId, (tx) =>
        tx
          .select({ aspect: renderOutputs.aspect, durationMs: renderOutputs.durationMs })
          .from(renderOutputs)
          .where(eq(renderOutputs.versionId, p.headVersionId!)),
      )
    : [];
  const status = API_STATUS(p.status);
  return {
    id,
    status,
    progress: status === "ready" || status === "needs_attention" ? 1 : Math.max(0, Math.min(1, p.fraction)),
    message: API_MESSAGE[status]!,
    outputs: status === "ready" || status === "needs_attention" ? outs : [],
  };
}

const LINK_TTL_SEC = 3600;

/** Signed, expiring links for one aspect (first output when none is asked). */
export async function downloadLinks(workspaceId: string, id: string, aspect?: string) {
  const rows = await withWorkspace(server().db, workspaceId, async (tx) => {
    const [p] = await tx.select().from(projects).where(eq(projects.id, id));
    if (!p?.headVersionId) return null;
    return tx.select().from(renderOutputs).where(eq(renderOutputs.versionId, p.headVersionId));
  });
  if (!rows?.length) return null;
  const o = aspect ? rows.find((r) => r.aspect === aspect) : rows[0];
  if (!o) return null;
  const store = server().deps.store;
  return {
    mp4: await store.signedGetUrl(o.storageKey, LINK_TTL_SEC),
    ...(o.srtKey ? { srt: await store.signedGetUrl(o.srtKey, LINK_TTL_SEC) } : {}),
    ...(o.thumbnailKey ? { thumbnail: await store.signedGetUrl(o.thumbnailKey, LINK_TTL_SEC) } : {}),
    expiresAt: new Date(Date.now() + LINK_TTL_SEC * 1000).toISOString(),
  };
}
