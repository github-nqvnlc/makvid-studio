// Aligner client for apps/worker-align (Montreal Forced Aligner, ADR 0006).
import type { Aligner, TimedWord } from "./types";

export interface AlignUtterance {
  id: string;
  wav: Buffer;
  text: string;
}

export class MfaAligner implements Aligner {
  constructor(
    private readonly baseUrl: string = process.env.ALIGN_URL ?? "http://localhost:8090",
    private readonly timeoutMs = 900_000,
  ) {}

  async alignMany(utts: AlignUtterance[]): Promise<Map<string, TimedWord[]>> {
    const res = await fetch(`${this.baseUrl}/align`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        utterances: utts.map((u) => ({
          id: u.id,
          wav_base64: u.wav.toString("base64"),
          text: u.text.normalize("NFC"),
        })),
      }),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    const body = (await res.json()) as {
      utterances?: Array<{ id: string; words: TimedWord[] }>;
      error?: string;
    };
    if (!res.ok || !body.utterances)
      throw new Error(`aligner error ${res.status}: ${body.error ?? "no result"}`);
    return new Map(body.utterances.map((u) => [u.id, u.words]));
  }

  async align(req: { audio: Buffer; transcript?: string; language: "vi" }): Promise<{ words: TimedWord[] }> {
    if (!req.transcript) throw new Error("MFA needs the transcript (forced alignment)");
    const m = await this.alignMany([{ id: "u1", wav: req.audio, text: req.transcript }]);
    return { words: m.get("u1") ?? [] };
  }
}

/**
 * Map aligned (normalized, lower-case) words back onto the original script words in order.
 * MFA drops punctuation and may merge/skip tokens; unmatched script words are interpolated.
 */
export function mapAlignedWords(scriptWords: string[], aligned: TimedWord[], totalMs: number): TimedWord[] {
  const key = (w: string) =>
    w
      .normalize("NFC")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]/gu, "");
  const out: Array<TimedWord | null> = scriptWords.map(() => null);
  let j = 0;
  for (let i = 0; i < scriptWords.length; i++) {
    const k = key(scriptWords[i]!);
    if (!k) continue;
    for (let look = j; look < Math.min(aligned.length, j + 4); look++) {
      if (key(aligned[look]!.text) === k) {
        out[i] = { text: scriptWords[i]!, startMs: aligned[look]!.startMs, endMs: aligned[look]!.endMs };
        j = look + 1;
        break;
      }
    }
  }
  // Interpolate gaps between known neighbours.
  for (let i = 0; i < out.length; i++) {
    if (out[i]) continue;
    let a = i - 1;
    while (a >= 0 && !out[a]) a--;
    let b = i + 1;
    while (b < out.length && !out[b]) b++;
    const t0 = a >= 0 ? out[a]!.endMs : 0;
    const t1 = b < out.length ? out[b]!.startMs : totalMs;
    const n = b - a - 1;
    const step = (t1 - t0) / Math.max(n, 1);
    for (let k = a + 1; k < b; k++)
      out[k] = {
        text: scriptWords[k]!,
        startMs: Math.round(t0 + step * (k - a - 1)),
        endMs: Math.round(t0 + step * (k - a)),
      };
    i = b - 1;
  }
  return out as TimedWord[];
}
