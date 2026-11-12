// T108b: MusicProvider contract against a local Soundstripe-shaped mock (JSON:API) + builtin fallback.
import { createServer, type Server } from "node:http";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BuiltinMusicProvider, musicProviderFromEnv, SoundstripeMusicProvider } from "../src/providers";

let server: Server;
let base = "";
const seen: Array<{ url: string; auth: string }> = [];
beforeAll(async () => {
  server = createServer((req, res) => {
    seen.push({ url: req.url!, auth: String(req.headers.authorization) });
    if (req.url!.startsWith("/files/")) {
      res.writeHead(200, { "content-type": "audio/mpeg" });
      return void res.end(Buffer.from("ID3fake-mp3"));
    }
    const doc = {
      data: [
        {
          id: "11",
          type: "songs",
          attributes: { title: "Calm One" },
          relationships: {
            artists: { data: [{ id: "a1" }] },
            audio_files: { data: [{ id: "f1" }, { id: "f2" }] },
          },
        },
        {
          id: "12",
          type: "songs",
          attributes: { title: "Calm Two" },
          relationships: { artists: { data: [{ id: "a1" }] }, audio_files: { data: [{ id: "f3" }] } },
        },
      ],
      included: [
        { id: "a1", type: "artists", attributes: { name: "Artist A" } },
        {
          id: "f1",
          type: "audio_files",
          attributes: {
            instrumental: false,
            duration: 120.5,
            versions: { mp3: `${base}/files/f1.mp3`, wav: null },
          },
        },
        {
          id: "f2",
          type: "audio_files",
          attributes: {
            instrumental: true,
            duration: 118,
            versions: { mp3: `${base}/files/f2.mp3`, wav: null },
          },
        },
        {
          id: "f3",
          type: "audio_files",
          attributes: {
            instrumental: true,
            duration: 90,
            versions: { mp3: `${base}/files/f3.mp3`, wav: null },
          },
        },
      ],
    };
    res.writeHead(200, { "content-type": "application/vnd.api+json" });
    res.end(JSON.stringify(doc));
  });
  await new Promise<void>((ok) => server.listen(0, "127.0.0.1", () => ok()));
  const a = server.address();
  base = `http://127.0.0.1:${typeof a === "object" && a ? a.port : 0}`;
});
afterAll(() => new Promise<void>((ok) => server.close(() => ok())));

describe("SoundstripeMusicProvider", () => {
  it("searches instrumental tracks by mood with token auth and picks deterministically", async () => {
    const p = new SoundstripeMusicProvider("test-key", base);
    const c = await p.choose({ moods: ["calm"], minDurationMs: 45_000, seed: 2 });
    expect(seen[0]!.auth).toBe("Token test-key");
    expect(decodeURIComponent(seen[0]!.url)).toContain("filter[instrumental]=true");
    expect(decodeURIComponent(seen[0]!.url)).toContain("filter[duration][min]=45");
    expect(c).toMatchObject({
      provider: "soundstripe",
      trackId: "11:f2",
      title: "Calm One",
      artist: "Artist A",
      durationMs: 118000,
    });
    const c2 = await p.choose({ moods: ["calm"], minDurationMs: 45_000, seed: 3 });
    expect(c2.trackId).toBe("12:f3");
  });

  it("downloads the audio at production time (fresh signed URL)", async () => {
    const p = new SoundstripeMusicProvider("test-key", base);
    const dest = join(mkdtempSync(join(tmpdir(), "mkv-music-")), "music.mp3");
    await p.fetchAudio(
      { provider: "soundstripe", trackId: "11:f2", title: "x", durationMs: 1, license: "" },
      dest,
    );
    expect(readFileSync(dest, "utf8")).toBe("ID3fake-mp3");
  });
});

describe("fallback", () => {
  it("uses the procedural library without a key", async () => {
    const p = musicProviderFromEnv({});
    expect(p).toBeInstanceOf(BuiltinMusicProvider);
    const c = await p.choose({ moods: ["energetic"], minDurationMs: 45_000, seed: 1 });
    expect(c.provider).toBe("builtin");
    expect(existsSync(await p.fetchAudio(c, ""))).toBe(true);
  });
});
