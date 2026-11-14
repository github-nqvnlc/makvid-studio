// GET: the workspace's projects. POST: create a project from an idea (JSON) or from another source
// (multipart form: written script, article link, GitHub repo, data file, audio/video upload) and start
// production (T102, T117). Text sources are ingested here (seconds); uploaded media is transcribed by the worker.
import { z } from "zod";
import {
  ingestArticle,
  ingestGithub,
  ingestScript,
  ingestTable,
  SafeFetchError,
  type SourceMaterial,
} from "@makvid/media";
import { attachReservation, planOf, QuotaError, reserve, settle } from "@makvid/billing";
import { freeBlocked } from "@/server/abuse";
import { createProject } from "@makvid/pipeline";
import { voiceCatalog } from "@makvid/tts";
import { parseListQuery } from "@/lib/project-query";
import { fail, guarded } from "@/server/api";
import { listProjects } from "@/server/projects-list";
import { server } from "@/server/deps";
import { resolveBrandKit } from "@/server/assets";
import { UploadError, validateUpload } from "@/server/uploads";

export const dynamic = "force-dynamic";

export function GET(req: Request) {
  return guarded("GET /api/projects", async (v) => {
    const q = parseListQuery(new URL(req.url).searchParams);
    if (!q.success) return fail("invalid");
    return Response.json(await listProjects(server().db, server().deps.store, v.workspaceId, q.data));
  });
}

const Common = z.object({
  aspect: z.enum(["9:16", "16:9", "1:1", "4:5"]),
  durationSec: z.coerce.number().int().min(30).max(180),
  mode: z.enum(["auto", "review"]),
  voiceId: z.string(),
  useBrand: z.union([z.boolean(), z.enum(["true", "false"]).transform((x) => x === "true")]).optional(),
});
const Source = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("prompt"), prompt: z.string().trim().min(3).max(4000) }),
  z.object({ kind: z.literal("script"), text: z.string().trim().min(10).max(12_000) }),
  z.object({ kind: z.literal("url"), url: z.string().trim().url().max(2000) }),
  z.object({ kind: z.literal("github"), url: z.string().trim().min(3).max(300) }),
  z.object({ kind: z.literal("table"), title: z.string().trim().max(120).optional() }),
  z.object({ kind: z.literal("media"), useSourceAudio: z.enum(["true", "false"]).optional() }),
]);

type Parsed = { common: z.infer<typeof Common>; source: z.infer<typeof Source>; file?: File };

async function parse(req: Request): Promise<Parsed | null> {
  if ((req.headers.get("content-type") ?? "").includes("multipart/form-data")) {
    const form = await req.formData().catch(() => null);
    if (!form) return null;
    const obj = Object.fromEntries([...form.entries()].filter(([, v]) => typeof v === "string"));
    const common = Common.safeParse(obj);
    const source = Source.safeParse(obj);
    if (!common.success || !source.success) return null;
    const file = form.get("file");
    return { common: common.data, source: source.data, ...(file instanceof File ? { file } : {}) };
  }
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const common = Common.safeParse(body);
  const source = Source.safeParse({ kind: "prompt", ...body });
  if (!common.success || !source.success) return null;
  return { common: common.data, source: source.data };
}

export function POST(req: Request) {
  return guarded("POST /api/projects", async (v) => {
    const p = await parse(req);
    if (!p) return fail("invalid");
    const { common: c, source: s } = p;
    if (!voiceCatalog().some((x) => x.id === c.voiceId)) return fail("invalid");

    let source: SourceMaterial | undefined;
    let media: { bytes: Buffer; ext: string } | undefined;
    let label: string;
    try {
      switch (s.kind) {
        case "prompt":
          label = s.prompt;
          break;
        case "script":
          source = ingestScript(s.text);
          label = source.sentences![0]!;
          break;
        case "url":
          source = await ingestArticle(s.url);
          label = source.title || s.url;
          break;
        case "github":
          source = await ingestGithub(s.url);
          label = source.title!;
          break;
        case "table": {
          if (!p.file) return fail("file_empty");
          const bytes = new Uint8Array(await p.file.arrayBuffer());
          const kind = validateUpload(bytes, "table");
          source = ingestTable(new TextDecoder().decode(bytes), {
            format: kind.ext === "json" ? "json" : "csv",
            ...(s.title ? { title: s.title } : {}),
          });
          label = s.title || p.file.name || "Dữ liệu";
          break;
        }
        case "media": {
          if (!p.file) return fail("file_empty");
          const bytes = new Uint8Array(await p.file.arrayBuffer());
          const kind = validateUpload(bytes, "media");
          media = { bytes: Buffer.from(bytes), ext: kind.ext };
          label = (p.file.name || "Âm thanh").replace(/\.[^.]+$/, "");
          break;
        }
      }
    } catch (e) {
      if (e instanceof UploadError) return fail(e.code);
      if (e instanceof SafeFetchError) return fail("source_unreachable");
      console.warn("source ingest failed", (e as Error).message);
      return fail("source_unreadable");
    }
    const brand = c.useBrand ? await resolveBrandKit(v.workspaceId) : null;
    // Free plan refused to accounts flagged at sign-up (many accounts from one IP/device, disposable email).
    if (
      (await planOf(server().db, v.workspaceId)).id === "free" &&
      (await freeBlocked(server().db, [v.userId]))
    )
      throw new QuotaError("videos");
    // Quota is reserved before any paid work is queued (SC-008); QuotaError -> 402 in guarded().
    const words = s.kind === "script" ? s.text : (source?.markdown ?? "");
    const r = await reserve(server().db, v.workspaceId, {
      videoSeconds: c.durationSec,
      ttsChars: Math.min([...words].length || c.durationSec * 15, c.durationSec * 25),
    });
    let id: string;
    try {
      id = await createProject(server().deps, {
        workspaceId: v.workspaceId,
        userId: v.userId,
        prompt: [...label.normalize("NFC").trim()].slice(0, 200).join("") || "Video",
        aspects: [c.aspect],
        durationSec: c.durationSec,
        mode: c.mode,
        voiceId: c.voiceId,
        ...(source ? { source } : {}),
        ...(media ? { media, useSourceAudio: s.kind === "media" && s.useSourceAudio === "true" } : {}),
        ...(brand ? { brand } : {}),
        onCreated: (pid) => attachReservation(server().db, v.workspaceId, r.id, pid),
      });
    } catch (e) {
      await settle(server().db, v.workspaceId, { reservationId: r.id }, false);
      throw e;
    }
    return Response.json({ id }, { status: 201 });
  });
}
