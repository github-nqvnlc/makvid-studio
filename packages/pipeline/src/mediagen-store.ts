// MediaGenStore backed by the workspace's asset library: the image goes to object storage as an `ai` asset
// (deduped by sha256) and media_gen_cache maps the request hash to it. Both tables are under RLS.
import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { assets, mediaGenCache, withWorkspace, type Db } from "@makvid/db";
import type { MediaGenStore } from "@makvid/media";
import { workspaceKey, type ObjectStore } from "@makvid/storage";

const EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};

export function dbMediaGenStore(db: Db, store: ObjectStore, workspaceId: string): MediaGenStore {
  return {
    async get(key) {
      const [row] = await withWorkspace(db, workspaceId, (tx) =>
        tx
          .select({ storageKey: assets.storageKey, mime: assets.mime })
          .from(mediaGenCache)
          .innerJoin(assets, eq(assets.id, mediaGenCache.assetId))
          .where(eq(mediaGenCache.cacheKey, key)),
      );
      if (!row) return null;
      return { image: await store.get(row.storageKey), mime: row.mime };
    },

    async put(key, e) {
      const sha256 = createHash("sha256").update(e.image).digest("hex");
      const storageKey = workspaceKey(workspaceId, "assets", `${sha256}.${EXT[e.mime] ?? "bin"}`);
      await store.put(storageKey, e.image, { contentType: e.mime });
      await withWorkspace(db, workspaceId, async (tx) => {
        const [found] = await tx
          .select({ id: assets.id })
          .from(assets)
          .where(and(eq(assets.workspaceId, workspaceId), eq(assets.sha256, sha256)));
        const assetId =
          found?.id ??
          (
            await tx
              .insert(assets)
              .values({
                workspaceId,
                kind: "generated_image",
                name: e.prompt.normalize("NFC").slice(0, 200),
                storageKey,
                mime: e.mime,
                bytes: e.image.length,
                sha256,
                metadata: { prompt: e.prompt.normalize("NFC") },
                license: { source: "ai", terms: "generated for this workspace" },
                origin: "ai",
              })
              .returning({ id: assets.id })
          )[0]!.id;
        await tx
          .insert(mediaGenCache)
          .values({
            cacheKey: key,
            workspaceId,
            assetId,
            provider: e.provider,
            model: e.model,
            costUsd: e.costUsd.toFixed(6),
          })
          .onConflictDoNothing();
      });
    },
  };
}
