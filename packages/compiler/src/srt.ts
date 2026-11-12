// SubRip (.srt) writer. UTF-8 without BOM, CRLF line endings, NFC text (Vietnamese diacritics intact).
export interface SrtCue {
  startMs: number;
  endMs: number;
  text: string;
}

export function srtTime(ms: number): string {
  const v = Math.max(0, Math.round(ms));
  const h = Math.floor(v / 3_600_000);
  const m = Math.floor((v % 3_600_000) / 60_000);
  const s = Math.floor((v % 60_000) / 1000);
  const r = v % 1000;
  const p = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${p(h)}:${p(m)}:${p(s)},${p(r, 3)}`;
}

export function toSrt(cues: SrtCue[]): string {
  return cues
    .filter((c) => c.text.trim() && c.endMs > c.startMs)
    .map(
      (c, i) =>
        `${i + 1}\r\n${srtTime(c.startMs)} --> ${srtTime(c.endMs)}\r\n${c.text.normalize("NFC").trim()}\r\n`,
    )
    .join("\r\n");
}

/** Parse an SRT string (used by tests and for user-supplied subtitles). */
export function parseSrt(srt: string): SrtCue[] {
  const toMs = (t: string) => {
    const m = /(\d+):(\d+):(\d+),(\d+)/.exec(t);
    if (!m) throw new Error(`bad SRT time "${t}"`);
    return Number(m[1]) * 3_600_000 + Number(m[2]) * 60_000 + Number(m[3]) * 1000 + Number(m[4]);
  };
  return srt
    .replace(/^\uFEFF/, "")
    .split(/\r?\n\r?\n/)
    .map((b) => b.trim())
    .filter(Boolean)
    .map((b) => {
      const lines = b.split(/\r?\n/);
      const [a, z] = (lines[1] ?? "").split(" --> ");
      return { startMs: toMs(a ?? ""), endMs: toMs(z ?? ""), text: lines.slice(2).join("\n") };
    });
}
