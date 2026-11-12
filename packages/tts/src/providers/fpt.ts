// FPT AI Marketplace TTS (ADR 0002): OpenAI-compatible POST /v1/audio/speech, WAV output, no word timing.
// Voice lists verified by real calls on 2026-11-12 (the API returns the allowed list on an unknown voice).
import OpenAI from "openai";
import type { SynthesisResult, TtsProvider, Voice } from "../types";

const MODELS = {
  vits: { name: "FPT.AI-VITs", usdPerMChar: 16.5 },
  pro: { name: "FPT.TTS-pro", usdPerMChar: 16.5 },
  ultra: { name: "FPT.TTS-ultra", usdPerMChar: 99 },
} as const;
type ModelKey = keyof typeof MODELS;

type V = [string, Voice["gender"], Voice["region"]];
const VOICES: Record<ModelKey, V[]> = {
  vits: [
    ["banmai", "female", "north"],
    ["thuminh", "female", "north"],
    ["leminh", "male", "north"],
    ["minhquan", "male", "north"],
    ["ngoclam", "female", "central"],
    ["giahuy", "male", "central"],
    ["kimngan", "female", "south"],
    ["hatieumai", "female", "south"],
    ["huyphong", "male", "south"],
  ],
  pro: [
    ["std_banmai", "female", "north"],
    ["std_quanganh", "male", "north"],
    ["fci_phuongan", "female", null],
    ["fci_vietkhoa", "male", null],
    ["fci_xuantoan", "male", null],
  ],
  ultra: [
    ["std_banmai", "female", "north"],
    ["std_kimngan", "female", "south"],
    ["std_quanganh", "male", "north"],
    ["std_minhquang", "male", null],
    ["std_vietkhoa", "male", null],
    ["fci_phuongan", "female", null],
    ["fci_xuantoan", "male", null],
  ],
};

export function parseVoiceId(id: string): { model: ModelKey; voice: string } {
  const raw = id.replace(/^fpt:/, "");
  const [a, b] = raw.split(":");
  if (b && a && a in MODELS) return { model: a as ModelKey, voice: b };
  return { model: "vits", voice: raw }; // "banmai" / "fpt:banmai" -> VITs
}

export class FptTtsProvider implements TtsProvider {
  readonly id = "fpt";
  private client: OpenAI;
  constructor(apiKey: string, baseURL = "https://mkp-api.fptcloud.com/v1") {
    this.client = new OpenAI({ apiKey, baseURL, timeout: 120_000, maxRetries: 2 });
  }

  async listVoices(): Promise<Voice[]> {
    return (Object.keys(VOICES) as ModelKey[]).flatMap((m) =>
      VOICES[m].map(([v, gender, region]) => ({
        id: `${m}:${v}`,
        provider: "fpt",
        model: MODELS[m].name,
        providerVoiceId: v,
        language: "vi" as const,
        gender,
        region,
      })),
    );
  }

  async synthesize(req: { text: string; voiceId: string; speed?: number }): Promise<SynthesisResult> {
    const { model, voice } = parseVoiceId(req.voiceId);
    if (!VOICES[model].some(([v]) => v === voice))
      throw new Error(`voice "${voice}" is not available for ${MODELS[model].name}`);
    const text = req.text.normalize("NFC").trim();
    if (!text) throw new Error("empty text");
    const res = await this.client.audio.speech.create({
      model: MODELS[model].name,
      voice: voice as "alloy", // provider-specific voice ids; the SDK type only lists OpenAI voices
      input: text,
      response_format: "wav",
      ...(req.speed && req.speed !== 1 ? { speed: req.speed } : {}),
    });
    const audio = Buffer.from(await res.arrayBuffer());
    const chars = [...text].length;
    return {
      audio,
      mime: "audio/wav",
      chars,
      costUsd: Math.round(((chars * MODELS[model].usdPerMChar) / 1e6) * 1e6) / 1e6,
    };
  }
}
