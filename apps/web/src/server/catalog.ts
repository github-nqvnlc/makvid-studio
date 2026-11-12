// Style packs and voices offered in the UI (names + picker data; files are served by the API routes).
import "server-only";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { voiceCatalog, voiceTier, DEFAULT_VOICE_ID } from "@makvid/tts";
import { server } from "./deps";

export interface StyleCard {
  id: string;
  name: string;
  description: string;
}

export function styleCards(locale: "vi" | "en"): StyleCard[] {
  const root = server().deps.stylesRoot;
  return readdirSync(root, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(root, d.name, "manifest.json")))
    .map((d) => {
      const m = JSON.parse(readFileSync(join(root, d.name, "manifest.json"), "utf8")) as {
        name: Record<string, string>;
        description: Record<string, string>;
      };
      return {
        id: d.name,
        name: m.name[locale] ?? m.name.vi!,
        description: m.description[locale] ?? m.description.vi!,
      };
    });
}

export function styleThumbnailFile(id: string): string | null {
  if (!/^[a-z0-9-]+$/.test(id)) return null;
  const f = join(server().deps.stylesRoot, id, "demo", "thumbnail.webp");
  return existsSync(f) ? f : null;
}

export interface VoiceOption {
  id: string;
  tier: "standard" | "pro" | "ultra";
  gender: "female" | "male";
  region: "north" | "central" | "south" | null;
  name: string;
  isDefault: boolean;
}

/** Voice ids look like "vits:banmai"; the display name is the speaker part, title-cased. */
export function voiceOptions(): VoiceOption[] {
  return voiceCatalog().map((v) => {
    const speaker = v.providerVoiceId.replace(/^(std|fci)_/, "");
    return {
      id: v.id,
      tier: voiceTier(v.id),
      gender: v.gender,
      region: v.region,
      name: speaker.charAt(0).toUpperCase() + speaker.slice(1),
      isDefault: v.id === DEFAULT_VOICE_ID,
    };
  });
}
