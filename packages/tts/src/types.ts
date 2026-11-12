// TtsProvider / Aligner contract (contracts/provider-interfaces.md).
export interface Voice {
  id: string; // "<model>:<voice>", e.g. "vits:banmai", "pro:std_banmai"
  provider: string;
  model: string;
  providerVoiceId: string;
  language: "vi";
  gender: "female" | "male";
  region: "north" | "central" | "south" | null;
}

export interface TimedWord {
  text: string;
  startMs: number;
  endMs: number;
}

export interface SynthesisResult {
  audio: Buffer;
  mime: string;
  /** Present only when the provider returns native word timing. */
  words?: TimedWord[];
  chars: number;
  costUsd: number | null;
}

export interface TtsProvider {
  readonly id: string;
  listVoices(): Promise<Voice[]>;
  synthesize(req: { text: string; voiceId: string; speed?: number }): Promise<SynthesisResult>;
}

export interface Aligner {
  align(req: { audio: Buffer; transcript?: string; language: "vi" }): Promise<{ words: TimedWord[] }>;
}
