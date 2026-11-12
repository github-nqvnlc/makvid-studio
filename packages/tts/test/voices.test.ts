// T108a: every voice the provider offers has a playable preview clip in the library.
import { existsSync, statSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DEFAULT_VOICE_ID, FptTtsProvider, voiceCatalog, voicePreviewPath, voiceTier } from "../src";

describe("voice catalog", () => {
  it("has a non-empty preview clip for every provider voice", async () => {
    const ids = (await new FptTtsProvider("unused").listVoices()).map((v) => v.id);
    const cat = voiceCatalog();
    expect(cat.map((v) => v.id).sort()).toEqual([...ids].sort());
    for (const v of cat) {
      const p = voicePreviewPath(v.id);
      expect(existsSync(p) && statSync(p).size > 5_000).toBe(true);
      expect(v.durationMs).toBeGreaterThan(2_000);
      expect(v.durationMs).toBeLessThan(15_000);
    }
  });

  it("defaults to vits:banmai and classifies tiers", () => {
    expect(voiceCatalog().some((v) => v.id === DEFAULT_VOICE_ID)).toBe(true);
    expect(voiceTier("vits:banmai")).toBe("standard");
    expect(voiceTier("pro:std_banmai")).toBe("pro");
    expect(voiceTier("ultra:fci_xuantoan")).toBe("ultra");
  });
});
