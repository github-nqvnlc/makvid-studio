import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { lintMarkup, lintPack, lintScript } from "../src/node";
import { ASPECTS, TEMPLATE_IDS } from "../src";
import { LAYOUT_FILE } from "../src/node/loader";

const rules = (issues: { rule: string }[]) => issues.map((i) => i.rule);

describe("lintScript", () => {
  it.each([
    ["const v = Math.random();", "no-nondeterminism"],
    ["const t = Date.now();", "no-nondeterminism"],
    ["const t = performance.now();", "no-nondeterminism"],
    ["const t = window.Math.random();", "no-nondeterminism"],
    ['const v = Math["random"]();', "no-nondeterminism"],
    ["const d = new Date();", "no-nondeterminism"],
    ["setTimeout(() => {}, 10);", "no-timers"],
    ["setInterval(() => {}, 10);", "no-timers"],
    ["requestAnimationFrame(() => {});", "no-timers"],
    ["window.requestAnimationFrame(() => {});", "no-timers"],
    ['const u = "https://cdn.example.com/x.png";', "no-remote-url"],
    ['import("./x");', "no-dynamic-import"],
  ])("rejects %s", (src, rule) => {
    expect(rules(lintScript(src, "t.ts"))).toContain(rule);
  });

  it("ignores comments, strings mentioning the names, and deterministic code", () => {
    const src = [
      "// Math.random is forbidden; Date.now too",
      'const label = "setTimeout is not used here";',
      "const d = new Date(0);",
      "const r = ctx.rng.next();",
    ].join("\n");
    expect(lintScript(src, "t.ts")).toEqual([]);
  });

  it("reports line numbers", () => {
    expect(lintScript("const a = 1;\nconst b = Math.random();", "t.ts")[0]?.line).toBe(2);
  });
});

describe("lintMarkup", () => {
  it("rejects remote @import, absolute URLs and inline scripts", () => {
    expect(rules(lintMarkup('@import url("https://fonts.googleapis.com/css?family=X");', "a.css"))).toContain(
      "no-remote-import",
    );
    expect(rules(lintMarkup('<img src="http://x.y/z.png">', "a.html"))).toContain("no-remote-url");
    expect(rules(lintMarkup("<script>var a=1</script>", "a.html"))).toContain("no-script-in-layout");
  });
  it("allows SVG xmlns and relative assets", () => {
    expect(
      lintMarkup('<svg xmlns="http://www.w3.org/2000/svg"></svg><img src="assets/a.png">', "a.html"),
    ).toEqual([]);
  });
});

describe("lintPack", () => {
  let dir = "";
  afterEach(() => dir && rmSync(dir, { recursive: true, force: true }));

  const makePack = (opts: { dropLayout?: boolean; dropTemplate?: boolean; noMaxLength?: boolean } = {}) => {
    dir = mkdtempSync(join(tmpdir(), "pack-"));
    for (const t of TEMPLATE_IDS) {
      if (opts.dropTemplate && t === "quote") continue;
      const td = join(dir, "templates", t);
      mkdirSync(td, { recursive: true });
      writeFileSync(join(td, "template.ts"), "export default {};\n");
      const slot =
        opts.noMaxLength && t === "title"
          ? { type: "text", required: true }
          : { type: "text", required: true, maxLength: 60 };
      writeFileSync(join(td, "schema.json"), JSON.stringify({ slots: { title: slot } }));
      for (const a of ASPECTS) {
        if (opts.dropLayout && t === "cta" && a === "4:5") continue;
        writeFileSync(join(td, LAYOUT_FILE[a]), "<div>{{fit title}}</div>");
      }
    }
    return dir;
  };

  it("passes a structurally complete pack", () => {
    expect(lintPack(makePack())).toEqual([]);
  });
  it("flags a missing layout", () => {
    expect(rules(lintPack(makePack({ dropLayout: true })))).toContain("missing-layout");
  });
  it("flags a missing template", () => {
    expect(rules(lintPack(makePack({ dropTemplate: true })))).toContain("missing-template");
  });
  it("flags text slots without maxLength", () => {
    expect(rules(lintPack(makePack({ noMaxLength: true })))).toContain("slot-max-length");
  });
  it("flags non-deterministic template code", () => {
    const d = makePack();
    writeFileSync(join(d, "templates", "hook", "template.ts"), "export const x = Math.random();\n");
    expect(rules(lintPack(d))).toContain("no-nondeterminism");
  });
});
