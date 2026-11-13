// T119: upload validation — allowlist, real type from the bytes (not the name or browser MIME), size limits.
import { describe, expect, it } from "vitest";
import { sniff, UPLOAD_LIMITS, UploadError, validateUpload } from "@/server/uploads";

const bytes = (...parts: Array<string | number[]>) =>
  new Uint8Array(parts.flatMap((p) => (typeof p === "string" ? [...Buffer.from(p, "latin1")] : p)));
const code = (f: () => unknown) => {
  try {
    f();
    return "ok";
  } catch (e) {
    return e instanceof UploadError ? e.code : "other";
  }
};

describe("sniff", () => {
  it.each([
    ["mp4", bytes([0, 0, 0, 0x18], "ftypisom", [0, 0, 0, 0])],
    ["m4a", bytes([0, 0, 0, 0x18], "ftypM4A ", [0, 0, 0, 0])],
    ["mov", bytes([0, 0, 0, 0x14], "ftypqt  ", [0, 0, 0, 0])],
    ["wav", bytes("RIFF", [1, 2, 3, 4], "WAVEfmt ")],
    ["mp3", bytes("ID3", [3, 0, 0, 0])],
    ["mp3", bytes([0xff, 0xfb, 0x90, 0x64])],
    ["ogg", bytes("OggS", [0, 2, 0, 0])],
    ["webm", bytes([0x1a, 0x45, 0xdf, 0xa3, 0x9f])],
  ])("recognises %s from its bytes", (ext, b) => expect(sniff(b)?.ext).toBe(ext));

  it("recognises CSV (with BOM, Vietnamese text) and JSON as tables", () => {
    expect(sniff(new TextEncoder().encode("﻿Tháng;Giá\n01/2026;82,5\n"))).toEqual({
      kind: "table",
      ext: "csv",
    });
    expect(sniff(new TextEncoder().encode(' [{"a": 1}]'))).toEqual({ kind: "table", ext: "json" });
  });

  it("rejects executables, HTML, images posing as data, binary junk and invalid UTF-8", () => {
    expect(sniff(bytes("MZ", [0x90, 0, 3, 0]))).toBeNull(); // Windows executable
    expect(sniff(bytes([0x7f], "ELF", [2, 1]))).toBeNull();
    expect(sniff(new TextEncoder().encode("<html><script>alert(1)</script></html>"))).toBeNull();
    expect(sniff(bytes([0x89], "PNG", [0x0d, 0x0a, 0x1a, 0x0a]))).toBeNull();
    expect(sniff(bytes("a,b\n", [0xc3, 0x28], "\n"))).toBeNull(); // invalid UTF-8
    expect(sniff(bytes("a,b\n1,", [0], "2\n"))).toBeNull(); // NUL byte
  });
});

describe("validateUpload", () => {
  it("accepts the right kind and rejects the wrong one (a video is not a data file)", () => {
    expect(validateUpload(bytes([0, 0, 0, 0x18], "ftypisom", [0, 0, 0, 0]), "media").ext).toBe("mp4");
    expect(code(() => validateUpload(bytes([0, 0, 0, 0x18], "ftypisom", [0, 0, 0, 0]), "table"))).toBe(
      "file_type",
    );
    expect(code(() => validateUpload(new TextEncoder().encode("a,b\n1,2\n"), "media"))).toBe("file_type");
  });
  it("enforces size limits per kind and rejects empty files", () => {
    expect(code(() => validateUpload(new Uint8Array(0), "table"))).toBe("file_empty");
    const big = new Uint8Array(UPLOAD_LIMITS.table + 1).fill(0x41);
    expect(code(() => validateUpload(big, "table"))).toBe("file_too_large");
  });
});
