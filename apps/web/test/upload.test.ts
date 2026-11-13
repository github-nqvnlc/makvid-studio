// T119: upload validation — allowlist, real type from the bytes (not the name or browser MIME), size limits.
import { describe, expect, it } from "vitest";
import { safeSvg, sniff, UPLOAD_LIMITS, UploadError, validateUpload } from "@/server/uploads";

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

describe("images and fonts (brand kit, asset library)", () => {
  it.each([
    ["png", "image", bytes([0x89], "PNG", [0x0d, 0x0a, 0x1a, 0x0a])],
    ["jpg", "image", bytes([0xff, 0xd8, 0xff, 0xe0])],
    ["webp", "image", bytes("RIFF", [1, 2, 3, 4], "WEBPVP8 ")],
    ["woff2", "font", bytes("wOF2", [0, 1, 0, 0])],
    ["woff", "font", bytes("wOFF", [0, 1, 0, 0])],
    ["otf", "font", bytes("OTTO", [0, 9, 0, 0x80])],
    ["ttf", "font", bytes([0, 1, 0, 0, 0, 0x12])],
  ])("recognises %s", (ext, kind, b) => expect(sniff(b)).toEqual({ kind, ext }));

  const ns = 'xmlns="http://www.w3.org/2000/svg"';
  it("accepts a plain SVG drawing", () => {
    const svg = `<?xml version="1.0"?><svg ${ns} viewBox="0 0 10 10"><defs><linearGradient id="g"/></defs><rect fill="url(#g)" width="10" height="10"/></svg>`;
    expect(sniff(new TextEncoder().encode(svg))).toEqual({ kind: "image", ext: "svg" });
  });
  it.each([
    ["script", `<svg ${ns}><script>alert(1)</script></svg>`],
    ["event handler", `<svg ${ns} onload="alert(1)"><rect/></svg>`],
    ["foreignObject", `<svg ${ns}><foreignObject><div>x</div></foreignObject></svg>`],
    ["external image", `<svg ${ns}><image href="https://evil.example/x.png"/></svg>`],
    ["external css", `<svg ${ns}><rect style="fill:url(https://evil.example/a)"/></svg>`],
    ["javascript link", `<svg ${ns}><a href="javascript:alert(1)"><rect/></a></svg>`],
    ["entities", `<!DOCTYPE svg [<!ENTITY x "y">]><svg ${ns}/>`],
    ["use (external sprite)", `<svg ${ns}><use href="other.svg#a"/></svg>`],
    ["no namespace", `<svg viewBox="0 0 1 1"><rect/></svg>`],
  ])("rejects an SVG with %s", (_name, svg) => {
    expect(safeSvg(svg)).toBe(false);
    expect(sniff(new TextEncoder().encode(svg))).toBeNull();
  });
  it("keeps kinds apart and enforces their limits", () => {
    const png = bytes([0x89], "PNG", [0x0d, 0x0a, 0x1a, 0x0a]);
    expect(validateUpload(png, "image").ext).toBe("png");
    expect(code(() => validateUpload(png, "font"))).toBe("file_type");
    expect(code(() => validateUpload(png, "table"))).toBe("file_type");
    const big = new Uint8Array(UPLOAD_LIMITS.image + 1);
    big.set(png);
    expect(code(() => validateUpload(big, "image"))).toBe("file_too_large");
  });
});
