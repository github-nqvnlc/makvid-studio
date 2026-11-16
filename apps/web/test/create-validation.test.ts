import { describe, expect, it } from "vitest";
import { fileKindOk, parseLength, validateContent, type ContentValues } from "../src/components/create/validation";

const empty: ContentValues = { prompt: "", script: "", link: "", file: null };

describe("parseLength", () => {
  it("accepts 30..180 whole seconds", () => {
    expect(parseLength("30")).toBe(30);
    expect(parseLength("180")).toBe(180);
    expect(parseLength(" 45 ")).toBe(45);
  });
  it("rejects everything else", () => {
    for (const bad of ["29", "181", "", "abc", "45.5", "-30", "1e2", "0"]) expect(parseLength(bad)).toBeNull();
  });
});

describe("validateContent", () => {
  it("idea needs 3 characters, script 10", () => {
    expect(validateContent("prompt", { ...empty, prompt: "  hi " })).toBe("tooShort");
    expect(validateContent("prompt", { ...empty, prompt: "Lãi kép" })).toBeNull();
    expect(validateContent("script", { ...empty, script: "ngắn" })).toBe("scriptTooShort");
  });
  it("links must be http(s)", () => {
    expect(validateContent("url", empty)).toBe("linkMissing");
    expect(validateContent("github", { ...empty, link: "not a url" })).toBe("linkInvalid");
    expect(validateContent("url", { ...empty, link: "ftp://x.test/a" })).toBe("linkInvalid");
    expect(validateContent("github", { ...empty, link: "https://github.com/a/b" })).toBeNull();
  });
  it("files must match the type", () => {
    expect(validateContent("table", empty)).toBe("fileMissing");
    expect(fileKindOk("table", { name: "a.CSV", type: "" })).toBe(true);
    expect(fileKindOk("table", { name: "a.png", type: "image/png" })).toBe(false);
    expect(fileKindOk("media", { name: "a.mp3", type: "audio/mpeg" })).toBe(true);
    expect(fileKindOk("media", { name: "a.csv", type: "text/csv" })).toBe(false);
  });
});
