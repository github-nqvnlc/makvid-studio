// Minimal PCM WAV reader/writer (16-bit LE, mono or stereo -> mono float) for timing analysis and concat.
export interface Pcm {
  sampleRate: number;
  samples: Float32Array; // mono, -1..1
}

export function readWav(buf: Buffer): Pcm {
  if (buf.toString("ascii", 0, 4) !== "RIFF" || buf.toString("ascii", 8, 12) !== "WAVE")
    throw new Error("not a WAV file");
  let off = 12;
  let fmt: { channels: number; rate: number; bits: number; format: number } | undefined;
  while (off + 8 <= buf.length) {
    const id = buf.toString("ascii", off, off + 4);
    let size = buf.readUInt32LE(off + 4);
    const body = off + 8;
    if (id === "fmt ")
      fmt = {
        format: buf.readUInt16LE(body),
        channels: buf.readUInt16LE(body + 2),
        rate: buf.readUInt32LE(body + 4),
        bits: buf.readUInt16LE(body + 14),
      };
    if (id === "data") {
      if (!fmt) throw new Error("WAV data before fmt");
      if (fmt.format !== 1 || fmt.bits !== 16)
        throw new Error(`unsupported WAV (format ${fmt.format}, ${fmt.bits}-bit)`);
      if (size === 0 || body + size > buf.length) size = buf.length - body; // streamed WAVs may report 0/oversized
      const frames = Math.floor(size / (2 * fmt.channels));
      const samples = new Float32Array(frames);
      for (let i = 0; i < frames; i++) {
        let acc = 0;
        for (let c = 0; c < fmt.channels; c++) acc += buf.readInt16LE(body + (i * fmt.channels + c) * 2);
        samples[i] = acc / fmt.channels / 32768;
      }
      return { sampleRate: fmt.rate, samples };
    }
    off = body + size + (size % 2);
  }
  throw new Error("WAV has no data chunk");
}

export function writeWav(pcm: Pcm): Buffer {
  const n = pcm.samples.length;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write("RIFF", 0, "ascii");
  buf.writeUInt32LE(36 + n * 2, 4);
  buf.write("WAVE", 8, "ascii");
  buf.write("fmt ", 12, "ascii");
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(pcm.sampleRate, 24);
  buf.writeUInt32LE(pcm.sampleRate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36, "ascii");
  buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++)
    buf.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(pcm.samples[i]! * 32767))), 44 + i * 2);
  return buf;
}

/** RMS envelope in dBFS over windows of `winMs` with hop `hopMs`. */
export function envelopeDb(pcm: Pcm, winMs = 20, hopMs = 5): Float32Array {
  const win = Math.max(1, Math.round((pcm.sampleRate * winMs) / 1000));
  const hop = Math.max(1, Math.round((pcm.sampleRate * hopMs) / 1000));
  const n = Math.max(0, Math.floor((pcm.samples.length - win) / hop) + 1);
  const out = new Float32Array(n);
  for (let f = 0; f < n; f++) {
    let s = 0;
    for (let i = f * hop; i < f * hop + win; i++) s += pcm.samples[i]! * pcm.samples[i]!;
    out[f] = 10 * Math.log10(s / win + 1e-12);
  }
  return out;
}

/** Trim leading/trailing silence below `thresholdDb` (relative to peak); returns the trimmed PCM and offsets. */
export function trimSilence(pcm: Pcm, thresholdDb = -40, padMs = 15): { pcm: Pcm; startMs: number } {
  const env = envelopeDb(pcm, 10, 2);
  const peak = Math.max(...env);
  const thr = peak + thresholdDb;
  let a = env.findIndex((v) => v > thr);
  let b = env.length - 1 - [...env].reverse().findIndex((v) => v > thr);
  if (a < 0) return { pcm, startMs: 0 };
  const hop = (pcm.sampleRate * 2) / 1000;
  const pad = Math.round((pcm.sampleRate * padMs) / 1000);
  const s0 = Math.max(0, Math.round(a * hop) - pad);
  const s1 = Math.min(pcm.samples.length, Math.round(b * hop + (pcm.sampleRate * 10) / 1000) + pad);
  a = s0;
  b = s1;
  return {
    pcm: { sampleRate: pcm.sampleRate, samples: pcm.samples.slice(a, b) },
    startMs: (a / pcm.sampleRate) * 1000,
  };
}

export function concatPcm(
  parts: Array<{ pcm: Pcm; gapAfterMs: number }>,
  leadMs = 0,
): { pcm: Pcm; onsetsMs: number[] } {
  if (!parts.length) throw new Error("nothing to concat");
  const rate = parts[0]!.pcm.sampleRate;
  if (parts.some((p) => p.pcm.sampleRate !== rate)) throw new Error("sample rates differ");
  const lead = Math.round((rate * leadMs) / 1000);
  const total =
    lead + parts.reduce((n, p) => n + p.pcm.samples.length + Math.round((rate * p.gapAfterMs) / 1000), 0);
  const out = new Float32Array(total);
  const onsetsMs: number[] = [];
  let pos = lead;
  for (const p of parts) {
    onsetsMs.push((pos / rate) * 1000);
    out.set(p.pcm.samples, pos);
    pos += p.pcm.samples.length + Math.round((rate * p.gapAfterMs) / 1000);
  }
  return { pcm: { sampleRate: rate, samples: out }, onsetsMs };
}
