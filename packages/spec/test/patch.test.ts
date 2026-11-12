import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { applyJsonPatch, applySpecPatch, PatchError, sceneIndex, type VideoSpec } from "../src";

const fixture = (): VideoSpec =>
  JSON.parse(readFileSync(new URL("../../../fixtures/specs/sample-vi.json", import.meta.url), "utf8"));

describe("RFC 6902 applyJsonPatch", () => {
  const doc = { a: 1, b: { c: [1, 2, 3] }, "x/y": 5, "t~": 6 };

  it("add / remove / replace / move / copy / test", () => {
    const out = applyJsonPatch(doc, [
      { op: "add", path: "/b/c/1", value: 9 },
      { op: "add", path: "/b/c/-", value: 4 },
      { op: "remove", path: "/a" },
      { op: "replace", path: "/x~1y", value: 7 },
      { op: "copy", from: "/t~0", path: "/d" },
      { op: "move", from: "/d", path: "/e" },
      { op: "test", path: "/e", value: 6 },
    ]);
    expect(out).toEqual({ b: { c: [1, 9, 2, 3, 4] }, "x/y": 7, "t~": 6, e: 6 });
  });

  it("is atomic and never mutates the input", () => {
    const before = structuredClone(doc);
    expect(() =>
      applyJsonPatch(doc, [
        { op: "replace", path: "/a", value: 2 },
        { op: "test", path: "/a", value: 3 },
      ]),
    ).toThrow(PatchError);
    expect(doc).toEqual(before);
  });

  it("fails on missing paths and bad indexes", () => {
    expect(() => applyJsonPatch(doc, [{ op: "replace", path: "/zz", value: 1 }])).toThrow(/not found/);
    expect(() => applyJsonPatch(doc, [{ op: "remove", path: "/b/c/3" }])).toThrow(/out of range/);
    expect(() => applyJsonPatch(doc, [{ op: "add", path: "/b/c/01", value: 1 }])).toThrow(
      /invalid array index/,
    );
    expect(() => applyJsonPatch(doc, [{ op: "move", from: "/b", path: "/b/z" }])).toThrow(/own child/);
  });
});

describe("applySpecPatch + affectedScenes", () => {
  it("slot change affects only that scene", () => {
    const s = fixture();
    const i = sceneIndex(s, "list");
    const r = applySpecPatch(s, [
      { op: "replace", path: `/scenes/${i}/slots/title`, value: "Ba điều cần nhớ" },
    ]);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.affectedScenes).toEqual(["list"]);
  });

  it("voice change affects all scenes", () => {
    const s = fixture();
    const r = applySpecPatch(s, [{ op: "replace", path: "/meta/voice", value: { voiceId: "fpt:leminh" } }]);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.affectedScenes).toHaveLength(s.scenes.length);
  });

  it("script change affects all scenes", () => {
    const s = fixture();
    const r = applySpecPatch(s, [{ op: "replace", path: "/script/0/text", value: "Câu mở đầu mới." }]);
    expect(r.ok && r.affectedScenes.length).toBe(s.scenes.length);
  });

  it("transition / timing change affects neighbours", () => {
    const s = fixture();
    const i = sceneIndex(s, "compare");
    const r = applySpecPatch(s, [
      { op: "replace", path: `/scenes/${i}/transitionIn/durationMs`, value: 600 },
    ]);
    expect(r.ok && r.affectedScenes).toEqual(["list", "compare", "stat"]);
    const r2 = applySpecPatch(s, [{ op: "replace", path: `/scenes/${i}/timing/durationMs`, value: 4500 }]);
    expect(r2.ok && r2.affectedScenes).toEqual(["list", "compare", "stat"]);
  });

  it("music change re-renders no scene", () => {
    const s = fixture();
    const r = applySpecPatch(s, [{ op: "add", path: "/meta/music", value: { mood: "calm" } }]);
    expect(r.ok && r.affectedScenes).toEqual([]);
  });

  it("normalizes patch values to NFC", () => {
    const s = fixture();
    const r = applySpecPatch(s, [
      { op: "replace", path: "/scenes/0/slots/headline", value: "Ẩn Ỹ Ự".normalize("NFD") },
    ]);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.spec.scenes[0]!.slots.headline).toBe("Ẩn Ỹ Ự".normalize("NFC"));
  });

  it("rejects a patch that breaks invariants and yields no spec", () => {
    const s = fixture();
    const r = applySpecPatch(s, [{ op: "replace", path: "/scenes/1/id", value: "hook" }]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issues.join()).toMatch(/duplicate scene id/);
  });

  it("removing a scene affects its neighbours", () => {
    const s = fixture();
    const r = applySpecPatch(s, [{ op: "remove", path: "/scenes/3" }]);
    expect(r.ok && r.affectedScenes).toEqual(["highlight", "compare"]);
  });
});
