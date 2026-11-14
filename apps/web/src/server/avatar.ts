// Profile pictures: PNG, JPEG or WebP by magic bytes (never SVG), at most 2 MB, stored as users/<id>/avatar-<sha8>.<ext>.
// users.image holds `/api/avatars/<id>?v=<sha8>.<ext>`; the `v` part is the cache buster and names the object.
import "server-only";
import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { users } from "@makvid/db";
import { assertKey } from "@makvid/storage";
import { server } from "./deps";
import { MIME, UploadError, validateUpload } from "./uploads";

export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
const OK = new Set(["png", "jpg", "webp"]);

export const avatarKey = (userId: string, v: string) => {
  const key = `users/${userId}/avatar-${v}`;
  assertKey(key);
  return key;
};

/** Validate and store; returns the new `image` value. The previous object is removed afterwards. */
export async function saveAvatar(userId: string, bytes: Uint8Array): Promise<string> {
  if (bytes.length > AVATAR_MAX_BYTES) throw new UploadError("file_too_large");
  const f = validateUpload(bytes, "image");
  if (!OK.has(f.ext)) throw new UploadError("file_type"); // svg and anything else that is "image" but not a bitmap
  const sha8 = createHash("sha256").update(bytes).digest("hex").slice(0, 8);
  const v = `${sha8}.${f.ext}`;
  const { db, deps } = server();
  const [prev] = await db.select({ image: users.image }).from(users).where(eq(users.id, userId));
  await deps.store.put(avatarKey(userId, v), bytes, { contentType: MIME[f.ext], cacheControl: "private, max-age=300" });
  const image = `/api/avatars/${userId}?v=${v}`;
  await db.update(users).set({ image, updatedAt: new Date() }).where(eq(users.id, userId));
  await removeObject(userId, prev?.image, v);
  return image;
}

export async function clearAvatar(userId: string): Promise<void> {
  const { db } = server();
  const [prev] = await db.select({ image: users.image }).from(users).where(eq(users.id, userId));
  await db.update(users).set({ image: null, updatedAt: new Date() }).where(eq(users.id, userId));
  await removeObject(userId, prev?.image, null);
}

async function removeObject(userId: string, image: string | null | undefined, keep: string | null) {
  const v = image ? new URL(image, "http://x").searchParams.get("v") : null;
  if (!v || v === keep || !/^[0-9a-f]{8}\.(png|jpg|webp)$/.test(v)) return;
  await server().deps.store.delete(avatarKey(userId, v)).catch(() => undefined);
}
