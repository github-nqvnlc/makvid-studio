// Asset library + brand kit (T122, T125): uploads are validated (validateUpload), de-duplicated per workspace by
// sha256, fonts must render Vietnamese, files live in object storage. Brand kits are resolved to local files
// in a content-addressed workspace folder so the workers can compile with them.
import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { and, desc, eq, inArray } from "drizzle-orm";
import type { BRAND_COLOR_KEYS} from "@makvid/compiler";
import { brandFontMissingGlyphs, type BrandKit } from "@makvid/compiler";
import { assets, brandKits, withWorkspace } from "@makvid/db";
import { fontInfo } from "@makvid/style-kit/node";
import { workspaceKey } from "@makvid/storage";
import { server } from "./deps";
import { MIME, UploadError, validateUpload, type UploadKind } from "./uploads";

export class FontGlyphError extends Error {
  constructor(readonly missing: string[]) {
    super("font_glyphs");
    this.name = "FontGlyphError";
  }
}

export interface AssetView {
  id: string;
  kind: string;
  name: string;
  mime: string;
  bytes: number;
  url: string | null;
  family?: string;
  weight?: number;
}

/** Store an upload once per workspace (same bytes -> the existing asset is returned). */
export async function saveAsset(
  workspaceId: string,
  bytes: Uint8Array,
  name: string,
  uploadKind: Extract<UploadKind, "image" | "font">,
): Promise<{ id: string; existing: boolean }> {
  const sniffed = validateUpload(bytes, uploadKind);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const { db, deps } = server();
  const [found] = await withWorkspace(db, workspaceId, (tx) =>
    tx
      .select({ id: assets.id })
      .from(assets)
      .where(and(eq(assets.workspaceId, workspaceId), eq(assets.sha256, sha256))),
  );
  if (found) return { id: found.id, existing: true };

  let metadata: Record<string, unknown> = {};
  if (uploadKind === "font") {
    const tmp = join(tmpdir(), `mkv-font-${randomUUID()}.${sniffed.ext}`);
    writeFileSync(tmp, bytes);
    try {
      const info = fontInfo(tmp);
      const missing = brandFontMissingGlyphs({ ...info, files: [tmp] });
      if (missing.length) throw new FontGlyphError(missing);
      metadata = info;
    } catch (e) {
      if (e instanceof FontGlyphError) throw e;
      throw new UploadError("file_type"); // not a readable font
    } finally {
      rmSync(tmp, { force: true });
    }
  }
  const storageKey = workspaceKey(workspaceId, "assets", `${sha256}.${sniffed.ext}`);
  await deps.store.put(storageKey, bytes, { contentType: MIME[sniffed.ext] });
  const [row] = await withWorkspace(db, workspaceId, (tx) =>
    tx
      .insert(assets)
      .values({
        workspaceId,
        kind: uploadKind,
        name: name.normalize("NFC").slice(0, 200) || `${uploadKind}.${sniffed.ext}`,
        storageKey,
        mime: MIME[sniffed.ext],
        bytes: bytes.length,
        sha256,
        metadata,
        license: { source: "upload", terms: "uploaded by the workspace" },
        origin: "upload",
      })
      .returning({ id: assets.id }),
  );
  return { id: row!.id, existing: false };
}

export async function listAssets(workspaceId: string, kinds?: string[]): Promise<AssetView[]> {
  const { db, deps } = server();
  const rows = await withWorkspace(db, workspaceId, (tx) =>
    tx
      .select()
      .from(assets)
      .where(
        kinds?.length
          ? inArray(assets.kind, kinds as Array<(typeof assets.$inferSelect)["kind"]>)
          : undefined,
      )
      .orderBy(desc(assets.createdAt))
      .limit(200),
  );
  return Promise.all(
    rows.map(async (a) => {
      const meta = a.metadata as { family?: string; weight?: number };
      return {
        id: a.id,
        kind: a.kind,
        name: a.name,
        mime: a.mime,
        bytes: a.bytes,
        url: a.kind === "image" ? await deps.store.signedGetUrl(a.storageKey, 3600) : null,
        ...(meta.family ? { family: meta.family, weight: meta.weight ?? 400 } : {}),
      };
    }),
  );
}

export interface BrandKitInput {
  name: string;
  colors: Partial<Record<(typeof BRAND_COLOR_KEYS)[number], string>>;
  logoAssetId: string | null;
  logoPosition: "top-left" | "top-right";
  fonts: { display?: string | null; body?: string | null };
}

export async function getBrandKit(workspaceId: string) {
  const { db } = server();
  const [kit] = await withWorkspace(db, workspaceId, (tx) =>
    tx.select().from(brandKits).where(eq(brandKits.isDefault, true)).limit(1),
  );
  return kit ?? null;
}

/** Create or update the workspace's default brand kit (referenced assets must belong to the workspace). */
export async function saveBrandKit(workspaceId: string, input: BrandKitInput) {
  const { db } = server();
  const ids = [input.logoAssetId, input.fonts.display, input.fonts.body].filter((x): x is string => !!x);
  return withWorkspace(db, workspaceId, async (tx) => {
    const owned = ids.length
      ? await tx.select({ id: assets.id, kind: assets.kind }).from(assets).where(inArray(assets.id, ids))
      : [];
    const kindOf = new Map(owned.map((a) => [a.id, a.kind]));
    if (input.logoAssetId && kindOf.get(input.logoAssetId) !== "image") throw new UploadError("file_type");
    for (const f of [input.fonts.display, input.fonts.body])
      if (f && kindOf.get(f) !== "font") throw new UploadError("file_type");
    const values = {
      name: input.name.normalize("NFC").slice(0, 80) || "Thương hiệu",
      colors: input.colors,
      logoAssetId: input.logoAssetId,
      logoPosition: input.logoPosition,
      fonts: {
        ...(input.fonts.display ? { display: input.fonts.display } : {}),
        ...(input.fonts.body ? { body: input.fonts.body } : {}),
      },
      updatedAt: new Date(),
    };
    const [existing] = await tx
      .select({ id: brandKits.id })
      .from(brandKits)
      .where(eq(brandKits.isDefault, true));
    if (existing) {
      await tx.update(brandKits).set(values).where(eq(brandKits.id, existing.id));
      return existing.id;
    }
    const [row] = await tx
      .insert(brandKits)
      .values({ workspaceId, isDefault: true, ...values })
      .returning({ id: brandKits.id });
    return row!.id;
  });
}

/**
 * The default brand kit as compiler input: logo and font files are copied from object storage into
 * WORK_ROOT/<workspace>/_brand/<sha256>.<ext> (content-addressed, so reuse is free and edits never clash).
 */
export async function resolveBrandKit(workspaceId: string): Promise<{ id: string; kit: BrandKit } | null> {
  const kit = await getBrandKit(workspaceId);
  if (!kit) return null;
  const { db, deps } = server();
  const fonts = kit.fonts as { display?: string; body?: string };
  const ids = [kit.logoAssetId, fonts.display, fonts.body].filter((x): x is string => !!x);
  const rows = ids.length
    ? await withWorkspace(db, workspaceId, (tx) => tx.select().from(assets).where(inArray(assets.id, ids)))
    : [];
  const dir = join(deps.workRoot, workspaceId, "_brand");
  mkdirSync(dir, { recursive: true });
  const local = async (id: string | null | undefined) => {
    const a = rows.find((r) => r.id === id);
    if (!a) return null;
    const file = join(dir, a.storageKey.split("/").pop()!);
    if (!existsSync(file)) writeFileSync(file, await deps.store.get(a.storageKey));
    return { file, meta: a.metadata as { family?: string; weight?: number } };
  };
  const out: BrandKit = { colors: kit.colors as BrandKit["colors"] };
  const logo = await local(kit.logoAssetId);
  if (logo)
    out.logo = { file: logo.file, position: kit.logoPosition === "top-left" ? "top-left" : "top-right" };
  const brandFonts: NonNullable<BrandKit["fonts"]> = {};
  for (const role of ["display", "body"] as const) {
    const f = await local(fonts[role]);
    if (f)
      brandFonts[role] = {
        family: `Brand ${role} ${f.meta.family ?? ""}`
          .replace(/[^p{L}p{N} _-]/gu, " ")
          .trim()
          .slice(0, 60),
        weight: f.meta.weight ?? 400,
        files: [f.file],
      };
  }
  if (brandFonts.body) brandFonts.caption = brandFonts.body;
  if (Object.keys(brandFonts).length) out.fonts = brandFonts;
  return { id: kit.id, kit: out };
}
