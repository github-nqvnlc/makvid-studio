// Source material (data-model: source_materials) produced by every ingest (US4). `markdown` is what the
// script step reads; kind-specific fields carry what must survive verbatim (script sentences, chart values,
// transcript words, licensed images).
export type SourceKind = "prompt" | "script" | "url" | "github" | "table" | "media";

export interface SeriesPoint {
  label: string;
  value: number;
}

export interface SourceMaterial {
  kind: SourceKind;
  /** Content for the LLM (NFC, trimmed, capped). */
  markdown: string;
  title?: string;
  metadata: Record<string, unknown>;
  /** kind "script": the narration, split into sentences but otherwise verbatim. */
  sentences?: string[];
  /** kind "table": chart-ready data (values exactly as in the file). */
  series?: SeriesPoint[];
  seriesName?: string;
  /** kind "url": images that may be reused (page license + robots allow it). */
  images?: Array<{ url: string; alt: string; license: string }>;
  /** kind "media": word timings of the transcript (ms) and the extracted audio. */
  transcript?: Array<{ text: string; startMs: number; endMs: number }>;
  audioFile?: string;
}

export const MAX_MARKDOWN = 8000;

/** NFC, collapse whitespace inside lines, keep paragraph breaks, cap length. */
export function cleanText(text: string, max = MAX_MARKDOWN): string {
  return text
    .normalize("NFC")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((l) => l.replace(/[ \t\u00a0]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, max);
}

/** Injectable text fetcher (tests use fixtures; production uses safeFetchText). */
export type TextFetcher = (
  url: string,
  headers?: Record<string, string>,
) => Promise<{ url: string; status: number; contentType: string; text: string }>;
