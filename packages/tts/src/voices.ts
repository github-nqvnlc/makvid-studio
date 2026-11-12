// Voice catalog for the voice picker (T108a): every FPT voice with a pre-generated preview clip
// (packages/tts/library/voices, built by scripts/gen-voice-previews.ts). Default voice: vits:banmai.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Voice } from "./types";

export const DEFAULT_VOICE_ID = "vits:banmai";
export const PREVIEW_TEXT =
  "Xin chào, mình là giọng đọc của MakVid Studio. Chúc bạn có một video thật ấn tượng!";

export interface VoicePreview extends Voice {
  /** File name inside the voices library directory. */
  file: string;
  durationMs: number;
}

export const VOICES_DIR = join(dirname(fileURLToPath(import.meta.url)), "../library/voices");

/** Tier shown in the picker: VITs is the cheapest, Ultra the most natural (and ~6x the price). */
export function voiceTier(id: string): "standard" | "pro" | "ultra" {
  return id.startsWith("ultra:") ? "ultra" : id.startsWith("pro:") ? "pro" : "standard";
}

export function voiceCatalog(): VoicePreview[] {
  const m = JSON.parse(readFileSync(join(VOICES_DIR, "manifest.json"), "utf8")) as { voices: VoicePreview[] };
  return m.voices;
}

export function voicePreviewPath(id: string): string {
  const v = voiceCatalog().find((x) => x.id === id);
  if (!v) throw new Error(`unknown voice "${id}"`);
  return join(VOICES_DIR, v.file);
}
