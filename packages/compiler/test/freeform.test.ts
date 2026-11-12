import { describe, expect, it } from "vitest";
import { lintFreeform } from "../src";

const ok = {
  html: '<div class="x">Xin chào</div>',
  css: ".x{color:var(--c-fg);font-family:var(--f-display)}",
  js: "tl.fromTo('.x',{opacity:0},{opacity:1},{duration:0.5},0);",
};
const rules = (f: Partial<typeof ok>) => lintFreeform({ ...ok, ...f }).map((i) => i.rule);

describe("freeform linter (T077)", () => {
  it("accepts token-only, deterministic, offline content", () => expect(lintFreeform(ok)).toEqual([]));
  it("blocks network and real-time APIs", () => {
    expect(rules({ js: "fetch('/x')" })).toContain("sandbox");
    expect(rules({ js: "const t = Date.now();" })).toContain("no-nondeterminism");
    expect(rules({ js: "setInterval(f, 10)" })).toContain("no-timers");
    expect(rules({ html: '<img src="https://x.y/a.png">' })).toContain("no-remote-url");
    expect(rules({ html: "<script src='a.js'></script>" })).toContain("no-script-in-layout");
    expect(rules({ html: '<div onclick="x()">a</div>' })).toContain("sandbox");
  });
  it("requires style tokens", () => {
    expect(rules({ css: ".x{color:#ff0000}" })).toContain("style-tokens");
    expect(rules({ css: ".x{font-family:Arial}" })).toContain("style-tokens");
  });
});
