// Caption track: words -> chunks (≤ maxWords, ≤ 2 lines, break at punctuation) -> fitted HTML.
// Rules (SC-013): max 2 lines, never break mid-word, inside the safe area, active word highlighted.
import { fitText, safeAreaPx, type Aspect, type Measure } from "@makvid/style-kit";
import type { Word } from "@makvid/spec";
import { escapeHtml } from "./layout";

export interface CaptionStyle {
  font: string;
  maxFontSize: number;
  minFontSize: number;
  lineHeight: number;
  maxWords: number;
  boxWidth: number; // fraction of the safe-area width
  bottom: number; // fraction of frame height above the safe-area bottom
}

export interface CaptionChunkOut {
  text: string;
  startMs: number; // absolute
  endMs: number;
  words: Word[];
  fontSize: number;
  lines: string[][];
  overflow: boolean;
}

/**
 * Group words into caption chunks: split at sentence and clause punctuation, split long clauses into
 * even parts (no orphan single word), and merge very short clauses with a neighbour when they fit.
 */
export function chunkWords(words: Word[], maxWords: number): Word[][] {
  const clauses: Word[][] = [];
  let cur: Word[] = [];
  for (const w of words) {
    cur.push(w);
    if (/[.!?…,;:—–]$/.test(w.text)) {
      clauses.push(cur);
      cur = [];
    }
  }
  if (cur.length) clauses.push(cur);
  const even: Word[][] = [];
  for (const c of clauses) {
    const parts = Math.ceil(c.length / maxWords);
    const size = Math.ceil(c.length / parts);
    for (let i = 0; i < c.length; i += size) even.push(c.slice(i, i + size));
  }
  const merged: Word[][] = [];
  for (const c of even) {
    const prev = merged[merged.length - 1];
    const prevEndsSentence = prev ? /[.!?…]$/.test(prev[prev.length - 1]!.text) : true;
    if (prev && !prevEndsSentence && (c.length < 3 || prev.length < 3) && prev.length + c.length <= maxWords)
      prev.push(...c);
    else merged.push([...c]);
  }
  return merged;
}

export function layoutCaptions(
  words: Word[],
  style: CaptionStyle,
  aspect: Aspect,
  measure: Measure,
  maxLines: 1 | 2,
  sceneEndMs: number,
): CaptionChunkOut[] {
  const safe = safeAreaPx(aspect);
  const maxWidth = Math.round(safe.width * style.boxWidth);
  const out: CaptionChunkOut[] = [];
  const place = (chunk: Word[]) => {
    const text = chunk.map((w) => w.text).join(" ");
    const r = fitText(text, {
      maxWidth,
      maxHeight: style.maxFontSize * style.lineHeight * maxLines,
      maxFontSize: style.maxFontSize,
      minFontSize: style.minFontSize,
      lineHeight: style.lineHeight,
      maxLines,
      measure,
    });
    if (r.overflow && chunk.length > 1) {
      const mid = Math.ceil(chunk.length / 2);
      place(chunk.slice(0, mid));
      place(chunk.slice(mid));
      return;
    }
    let k = 0;
    const lines = r.lines.map((l) => l.split(" ").map(() => chunk[k++]!.text));
    out.push({
      text,
      startMs: chunk[0]!.startMs,
      endMs: 0,
      words: chunk,
      fontSize: r.fontSize,
      lines,
      overflow: r.overflow,
    });
  };
  for (const c of chunkWords(words, style.maxWords)) place(c);
  out.forEach((c, i) => {
    const next = out[i + 1];
    const lastEnd = c.words[c.words.length - 1]!.endMs;
    c.endMs = next ? next.startMs : Math.min(sceneEndMs, lastEnd + 600);
  });
  return out;
}

/** HTML for the caption layer (positioned by pack CSS via #captions). */
export function captionsHtml(chunks: CaptionChunkOut[], style: CaptionStyle, maxWidth: number): string {
  const items = chunks
    .map((c) => {
      const lines = c.lines
        .map(
          (l) =>
            `<span class="ln">${l.map((w) => `<span class="cap-w">${escapeHtml(w)}</span>`).join(" ")}</span>`,
        )
        .join("");
      return `<div class="cap-chunk" data-qa="caption"><span class="fit" data-w="${maxWidth}" style="font-size:${c.fontSize}px;line-height:${style.lineHeight}">${lines}</span></div>`;
    })
    .join("");
  return `<div id="captions">${items}</div>`;
}
