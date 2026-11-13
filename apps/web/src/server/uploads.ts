// Upload validation (T122 core, constitution VII): an allowlist per kind, the real type sniffed from the first
// bytes (the browser's MIME type and the file name are only hints), and size limits per kind. Rejected files
// never reach the disk.
import "server-only";

export type UploadKind = "table" | "media";

export interface SniffedFile {
  kind: UploadKind;
  /** Canonical extension derived from the content (not from the user's file name). */
  ext: "csv" | "json" | "mp3" | "wav" | "m4a" | "mp4" | "mov" | "webm" | "ogg";
}

export const UPLOAD_LIMITS: Record<UploadKind, number> = {
  table: 2 * 1024 * 1024, // 2 MB
  media: 200 * 1024 * 1024, // 200 MB (≤ 5 minutes is enforced after decoding)
};

export class UploadError extends Error {
  constructor(readonly code: "file_type" | "file_too_large" | "file_empty") {
    super(code);
    this.name = "UploadError";
  }
}

const startsWith = (b: Uint8Array, sig: number[], at = 0) => sig.every((v, i) => b[at + i] === v);
const ascii = (b: Uint8Array, from: number, to: number) => String.fromCharCode(...b.subarray(from, to));

/** Identify the file from its bytes; null when it is not an allowed type. */
export function sniff(bytes: Uint8Array): SniffedFile | null {
  if (bytes.length < 4) return null;
  // ISO BMFF (mp4 / m4a / mov): "ftyp" at offset 4, brand decides.
  if (ascii(bytes, 4, 8) === "ftyp") {
    const brand = ascii(bytes, 8, 12);
    if (/^M4A |^M4B /.test(brand)) return { kind: "media", ext: "m4a" };
    if (brand === "qt  ") return { kind: "media", ext: "mov" };
    return { kind: "media", ext: "mp4" };
  }
  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 12) === "WAVE") return { kind: "media", ext: "wav" };
  if (ascii(bytes, 0, 4) === "OggS") return { kind: "media", ext: "ogg" };
  if (startsWith(bytes, [0x1a, 0x45, 0xdf, 0xa3])) return { kind: "media", ext: "webm" }; // EBML (webm/mkv)
  if (ascii(bytes, 0, 3) === "ID3" || (bytes[0] === 0xff && (bytes[1]! & 0xe0) === 0xe0))
    return { kind: "media", ext: "mp3" };
  // Text tables: valid UTF-8 without NUL bytes; JSON when it starts with [ or {.
  const head = bytes.subarray(0, Math.min(bytes.length, 64 * 1024));
  if (head.includes(0)) return null;
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(head.subarray(0, lastCompleteUtf8(head)));
  } catch {
    return null;
  }
  const t = text.replace(/^\uFEFF/, "").trimStart();
  if (/^[[{]/.test(t)) return { kind: "table", ext: "json" };
  const firstLine = t.split(/\r?\n/, 1)[0] ?? "";
  if (/[,;\t]/.test(firstLine) && t.includes("\n")) return { kind: "table", ext: "csv" };
  return null;
}

/** Length of the prefix that ends on a complete UTF-8 sequence (the sniff window may cut one). */
function lastCompleteUtf8(b: Uint8Array): number {
  const i = b.length;
  for (let k = 1; k <= 3 && i - k >= 0; k++) {
    const c = b[i - k]!;
    if ((c & 0xc0) === 0x80) continue; // continuation byte
    const need = c >= 0xf0 ? 4 : c >= 0xe0 ? 3 : c >= 0xc0 ? 2 : 1;
    return need > k ? i - k : i;
  }
  return i;
}

/** Validate an uploaded file for the expected kind. */
export function validateUpload(bytes: Uint8Array, expected: UploadKind): SniffedFile {
  if (!bytes.length) throw new UploadError("file_empty");
  if (bytes.length > UPLOAD_LIMITS[expected]) throw new UploadError("file_too_large");
  const s = sniff(bytes);
  if (!s || s.kind !== expected) throw new UploadError("file_type");
  return s;
}
