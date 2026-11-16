// Client-side rules of the composer (spec 003, contracts/create-request.md). Pure functions: easy to test.
export const SOURCES = ["prompt", "script", "url", "github", "table", "media"] as const;
export type SourceKind = (typeof SOURCES)[number];

export const LENGTH_MIN = 30;
export const LENGTH_MAX = 180;
export const PROMPT_MAX = 4000;
export const SCRIPT_MAX = 12000;

/** Whole seconds 30..180, or null (empty, decimal, negative, text, out of range). */
export function parseLength(raw: string): number | null {
  const s = raw.trim();
  if (!/^\d{1,4}$/.test(s)) return null;
  const n = Number(s);
  return n >= LENGTH_MIN && n <= LENGTH_MAX ? n : null;
}

export type ContentError = "tooShort" | "scriptTooShort" | "linkMissing" | "linkInvalid" | "fileMissing" | "fileKind";

export interface ContentValues {
  prompt: string;
  script: string;
  link: string;
  file: File | null;
}

export function isHttpUrl(v: string): boolean {
  try {
    const u = new URL(v.trim());
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export function fileKindOk(kind: "table" | "media", f: { name: string; type: string }): boolean {
  if (kind === "table") return /\.(csv|json)$/i.test(f.name);
  return f.type.startsWith("audio/") || f.type.startsWith("video/");
}

/** The first problem with the content of the active type, or null when it can be submitted. */
export function validateContent(kind: SourceKind, v: ContentValues): ContentError | null {
  if (kind === "prompt") return v.prompt.trim().length < 3 ? "tooShort" : null;
  if (kind === "script") return v.script.trim().length < 10 ? "scriptTooShort" : null;
  if (kind === "url" || kind === "github") {
    if (!v.link.trim()) return "linkMissing";
    return isHttpUrl(v.link) ? null : "linkInvalid";
  }
  if (!v.file) return "fileMissing";
  return fileKindOk(kind, v.file) ? null : "fileKind";
}
