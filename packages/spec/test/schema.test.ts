import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { normalizeDeep, parseVideoSpec, type VideoSpec } from "../src";

const fixture = (): VideoSpec =>
  JSON.parse(readFileSync(new URL("../../../fixtures/specs/sample-vi.json", import.meta.url), "utf8"));

describe("VideoSpec schema", () => {
  it("accepts the sample fixture", () => {
    const r = parseVideoSpec(fixture());
    expect(r.ok).toBe(true);
  });

  it("rejects decomposed (NFD) text and accepts it after normalizeDeep", () => {
    const s = fixture();
    s.script[0]!.text = "Ẩn Ỹ Ự".normalize("NFD");
    const r = parseVideoSpec(s);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issues.join()).toMatch(/NFC.*script\/0\/text/);
    expect(parseVideoSpec(normalizeDeep(s)).ok).toBe(true);
  });

  it("rejects duplicate scene ids", () => {
    const s = fixture();
    s.scenes[1]!.id = s.scenes[0]!.id;
    const r = parseVideoSpec(s);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issues.join()).toMatch(/duplicate scene id/);
  });

  it("rejects scriptRefs to unknown script ids", () => {
    const s = fixture();
    s.scenes[0]!.scriptRefs = ["nope"];
    const r = parseVideoSpec(s);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issues.join()).toMatch(/scriptRef "nope"/);
  });

  it('requires meta.language = "vi"', () => {
    const s = fixture() as unknown as { meta: { language: string } };
    s.meta.language = "en";
    expect(parseVideoSpec(s).ok).toBe(false);
  });

  it.each([29, 601])("rejects targetDurationSec %i", (d) => {
    const s = fixture();
    s.meta.targetDurationSec = d;
    expect(parseVideoSpec(s).ok).toBe(false);
  });

  it.each([30, 600])("accepts targetDurationSec %i", (d) => {
    const s = fixture();
    s.meta.targetDurationSec = d;
    expect(parseVideoSpec(s).ok).toBe(true);
  });

  it("only allows the four aspect ratios", () => {
    const s = fixture() as unknown as { meta: { aspectRatios: string[] } };
    s.meta.aspectRatios = ["16:9", "21:9"];
    expect(parseVideoSpec(s).ok).toBe(false);
  });

  it("requires freeform content for freeform scenes", () => {
    const s = fixture();
    s.scenes[0]!.templateId = "freeform";
    expect(parseVideoSpec(s).ok).toBe(false);
  });
});
