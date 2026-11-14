// Avatar upload validation: real type from the bytes, bitmap formats only, 2 MB cap. Rejections happen before any storage call.
import { describe, expect, it } from "vitest";
import { AVATAR_MAX_BYTES, avatarKey, saveAvatar } from "../src/server/avatar";
import { UploadError } from "../src/server/uploads";

const code = async (bytes: Uint8Array) => {
  try {
    await saveAvatar("11111111-1111-4111-8111-111111111111", bytes);
    return "accepted";
  } catch (e) {
    return e instanceof UploadError ? e.code : `other:${(e as Error).message}`;
  }
};

describe("saveAvatar rejects before touching storage", () => {
  it("empty file", async () => {
    expect(await code(new Uint8Array())).toBe("file_empty");
  });
  it("larger than 2 MB", async () => {
    const big = new Uint8Array(AVATAR_MAX_BYTES + 1);
    big.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(await code(big)).toBe("file_too_large");
  });
  it("SVG, even though it is an allowed logo type", async () => {
    expect(await code(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>'))).toBe("file_type");
  });
  it("HTML or script pretending to be a picture", async () => {
    expect(await code(new TextEncoder().encode("<html><script>alert(1)</script></html>"))).toBe("file_type");
  });
  it("a font or audio file", async () => {
    expect(await code(new Uint8Array([0x77, 0x4f, 0x46, 0x32, 0, 1, 0, 0, 0, 0, 0, 0]))).toBe("file_type");
  });
});

describe("avatarKey", () => {
  it("is scoped to the user and rejects traversal", () => {
    expect(avatarKey("u1", "abcd1234.webp")).toBe("users/u1/avatar-abcd1234.webp");
    expect(() => avatarKey("../x", "abcd1234.webp")).toThrow();
  });
});
