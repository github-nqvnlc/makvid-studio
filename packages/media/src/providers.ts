// MusicProvider (T108b, ADR 0007): licensed catalog (Soundstripe) with the project-owned procedural beds as
// offline fallback. Soundstripe API (docs.soundstripe.com, read 2026-11-12): server-to-server only,
// `Authorization: Token <key>`, JSON:API responses; audio URLs are signed and expire after 7 days, so a track is
// resolved and downloaded at production time, never stored as a URL. Trial keys return watermarked MP3s only.
import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { musicLibrary, musicPath, pickMusic } from "./index";

export interface MusicChoice {
  provider: "soundstripe" | "builtin";
  trackId: string;
  title: string;
  artist?: string;
  durationMs: number;
  /** License note stored with the project (proof of what was used). */
  license: string;
}

export interface MusicProvider {
  readonly id: MusicChoice["provider"];
  /** Pick a track for the given moods and minimum duration. */
  choose(req: { moods: string[]; minDurationMs: number; seed: number }): Promise<MusicChoice>;
  /** Download / locate the audio for a choice into `dest` (returns the local path). */
  fetchAudio(choice: MusicChoice, dest: string): Promise<string>;
}

export class BuiltinMusicProvider implements MusicProvider {
  readonly id = "builtin" as const;
  async choose(req: { moods: string[] }): Promise<MusicChoice> {
    const t = pickMusic({ moods: req.moods });
    return {
      provider: "builtin",
      trackId: t.id,
      title: t.title,
      durationMs: t.durationMs,
      license: "MakVid Studio procedural bed (project-owned)",
    };
  }
  async fetchAudio(choice: MusicChoice): Promise<string> {
    const t = musicLibrary().find((x) => x.id === choice.trackId) ?? musicLibrary()[0]!;
    return musicPath(t);
  }
}

/** Style-pack moods -> Soundstripe search words. */
const MOOD_QUERY: Record<string, string> = {
  calm: "calm ambient",
  corporate: "corporate uplifting",
  energetic: "energetic upbeat",
  upbeat: "upbeat positive",
  tech: "technology electronic",
};

interface JsonApiDoc {
  data: Array<{
    id: string;
    attributes: { title: string };
    relationships: {
      artists?: { data: Array<{ id: string }> };
      audio_files: { data: Array<{ id: string }> };
    };
  }>;
  included?: Array<{ id: string; type: string; attributes: Record<string, unknown> }>;
}

export class SoundstripeMusicProvider implements MusicProvider {
  readonly id = "soundstripe" as const;
  constructor(
    private readonly apiKey: string,
    private readonly baseUrl = "https://api.soundstripe.com/v1",
  ) {}

  private async get(path: string, params: Record<string, string>): Promise<JsonApiDoc> {
    const url = new URL(this.baseUrl + path);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    const res = await fetch(url, {
      headers: { Authorization: `Token ${this.apiKey}`, Accept: "application/vnd.api+json" },
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new Error(`music catalog error ${res.status}`);
    return (await res.json()) as JsonApiDoc;
  }

  async choose(req: { moods: string[]; minDurationMs: number; seed: number }): Promise<MusicChoice> {
    const q = req.moods.map((m) => MOOD_QUERY[m] ?? m).join(" ") || "background";
    const doc = await this.get("/songs", {
      "filter[q]": q,
      "filter[instrumental]": "true",
      "filter[duration][min]": String(Math.ceil(req.minDurationMs / 1000)),
      "page[size]": "20",
    });
    if (!doc.data.length) throw new Error("no matching track");
    const song = doc.data[req.seed % doc.data.length]!; // deterministic pick for a project
    const files = (doc.included ?? []).filter((x) => x.type === "audio_files");
    const audio =
      files.find(
        (f) =>
          song.relationships.audio_files.data.some((d) => d.id === f.id) &&
          f.attributes.instrumental === true,
      ) ?? files.find((f) => f.id === song.relationships.audio_files.data[0]?.id);
    const artistId = song.relationships.artists?.data[0]?.id;
    const artist = (doc.included ?? []).find((x) => x.type === "artists" && x.id === artistId);
    return {
      provider: "soundstripe",
      trackId: `${song.id}:${audio?.id ?? ""}`,
      title: song.attributes.title,
      ...(artist ? { artist: String(artist.attributes.name ?? "") } : {}),
      durationMs: Math.round(Number(audio?.attributes.duration ?? 0) * 1000),
      license: "Soundstripe catalog via API (partner agreement)",
    };
  }

  async fetchAudio(choice: MusicChoice, dest: string): Promise<string> {
    const [songId, audioId] = choice.trackId.split(":");
    const doc = await this.get(`/songs/${songId}`, { "filter[include_alternate_audio_files]": "true" });
    const files = (doc.included ?? []).filter((x) => x.type === "audio_files");
    const f = files.find((x) => x.id === audioId) ?? files[0];
    const versions = (f?.attributes.versions ?? {}) as { mp3?: string; wav?: string | null };
    const url = versions.wav ?? versions.mp3;
    if (!url) throw new Error("track has no downloadable audio");
    const res = await fetch(url, { signal: AbortSignal.timeout(120_000) });
    if (!res.ok || !res.body) throw new Error(`music download failed ${res.status}`);
    await mkdir(dirname(dest), { recursive: true });
    await pipeline(Readable.fromWeb(res.body as never), createWriteStream(dest));
    return dest;
  }
}

/** Licensed catalog when configured, procedural beds otherwise (and as fallback on errors). */
export function musicProviderFromEnv(env: NodeJS.ProcessEnv = process.env): MusicProvider {
  return env.SOUNDSTRIPE_API_KEY
    ? new SoundstripeMusicProvider(env.SOUNDSTRIPE_API_KEY)
    : new BuiltinMusicProvider();
}
