#!/usr/bin/env node
// makvid CLI (contracts/cli.md).
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import type { AspectRatio } from "@makvid/spec";
import type { RuntimeId } from "@makvid/style-kit";
import { lintPack, loadPack, PackError } from "@makvid/style-kit/node";
import { join } from "node:path";
import { CliError, EXIT, emit, loadSpec, setJson, stylesRoot } from "./io";
import { renderVideo } from "./commands/render";
import { qaVideo } from "./commands/qa";
import { golden, styleThumbnail } from "./commands/golden";
import { produce } from "./commands/produce";
import { closeSharedBrowser } from "@makvid/renderer";
import { existsSync, readdirSync } from "node:fs";

/** Installed style packs (folders with a manifest). */
const listStyleIds = () =>
  readdirSync(stylesRoot(), { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(stylesRoot(), d.name, "manifest.json")))
    .map((d) => d.name);

const USAGE = `makvid <command>
  render <spec.json> [--out <dir>] [--aspect 16:9,9:16,1:1,4:5] [--renderer hyperframes|fallback]
                     [--fps 30] [--no-cache] [--frame-hashes] [--runtime gsap|mkv] [--workers N] [--style <id>]
  qa <spec.json> [--out <dir>] [--aspect ...] [--style <id>]
  golden <style-id> [--update] [--runtime gsap|mkv] [--allow-host]
  golden <style-id|all> --thumbnails   (style picker thumbnail -> packages/styles/<id>/demo/thumbnail.webp)
  lint-style <style-id>
  validate <spec.json>
  produce --prompt "<text>" [--aspect 9:16] [--duration 45] [--style id] [--mix-styles a,b] [--voice vits:banmai] [--out dir]
Global: --json (NDJSON events on stdout)`;

const ASPECTS = new Set(["16:9", "9:16", "1:1", "4:5"]);

async function main(argv: string[]): Promise<number> {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      out: { type: "string" },
      aspect: { type: "string" },
      renderer: { type: "string" },
      fps: { type: "string" },
      "no-cache": { type: "boolean" },
      "frame-hashes": { type: "boolean" },
      runtime: { type: "string" },
      workers: { type: "string" },
      update: { type: "boolean" },
      "allow-host": { type: "boolean" },
      thumbnails: { type: "boolean" },
      json: { type: "boolean" },
      style: { type: "string" },
      "mix-styles": { type: "string" },
      prompt: { type: "string" },
      duration: { type: "string" },
      voice: { type: "string" },
      help: { type: "boolean", short: "h" },
    },
  });
  setJson(!!values.json);
  const [cmd, arg] = positionals;
  if (values.help || !cmd) {
    console.log(USAGE);
    return cmd ? EXIT.ok : EXIT.input;
  }
  const aspects = values.aspect?.split(",").map((a) => a.trim());
  if (aspects?.some((a) => !ASPECTS.has(a)))
    throw new CliError(`--aspect must be a subset of 16:9,9:16,1:1,4:5`, EXIT.input);
  const runtime = values.runtime as RuntimeId | undefined;
  if (runtime && runtime !== "gsap" && runtime !== "mkv")
    throw new CliError("--runtime must be gsap or mkv", EXIT.input);
  const out = resolve(values.out ?? "out");

  switch (cmd) {
    case "validate": {
      if (!arg) throw new CliError("validate needs <spec.json>", EXIT.input);
      const { spec, migrated } = loadSpec(arg);
      emit(
        "valid",
        { scenes: spec.scenes.length, migrated },
        `valid: ${spec.scenes.length} scenes, specVersion ${spec.specVersion}${migrated.length ? `, migrated ${migrated.join(", ")}` : ""}`,
      );
      return EXIT.ok;
    }
    case "lint-style": {
      if (!arg) throw new CliError("lint-style needs <style-id>", EXIT.input);
      const dir = join(stylesRoot(), arg);
      const issues = lintPack(dir);
      try {
        loadPack(dir);
      } catch (e) {
        if (e instanceof PackError)
          for (const m of e.issues) issues.push({ file: arg, line: 0, rule: "contract", message: m });
        else throw e;
      }
      for (const i of issues) emit("lint", { ...i }, `${i.file}:${i.line} [${i.rule}] ${i.message}`);
      emit(
        "lint-done",
        { issues: issues.length },
        issues.length ? `${issues.length} problem(s)` : `style "${arg}" ok`,
      );
      return issues.length ? EXIT.input : EXIT.ok;
    }
    case "render": {
      if (!arg) throw new CliError("render needs <spec.json>", EXIT.input);
      const renderer = (values.renderer ?? "hyperframes") as "hyperframes" | "fallback";
      if (renderer !== "hyperframes" && renderer !== "fallback")
        throw new CliError("--renderer must be hyperframes or fallback", EXIT.input);
      await renderVideo(arg, {
        out,
        renderer,
        cache: !values["no-cache"],
        ...(values.style ? { style: values.style } : {}),
        frameHashes: !!values["frame-hashes"],
        ...(aspects ? { aspects: aspects as AspectRatio[] } : {}),
        ...(values.fps ? { fps: Number(values.fps) } : {}),
        ...(runtime ? { runtime } : {}),
        ...(values.workers ? { workers: Number(values.workers) } : {}),
      });
      return EXIT.ok;
    }
    case "qa": {
      if (!arg) throw new CliError("qa needs <spec.json>", EXIT.input);
      const { spec } = loadSpec(arg, values.style);
      let failed = 0;
      for (const a of (aspects as AspectRatio[] | undefined) ?? spec.meta.aspectRatios) {
        const reports = await qaVideo(spec, a, out);
        for (const r of reports)
          for (const i of r.issues) {
            failed++;
            emit(
              "qa-issue",
              { aspect: a, sceneId: r.sceneId, ...i },
              `  [${a}] ${r.sceneId} @${i.atMs}ms ${i.rule}: ${i.detail}`,
            );
          }
      }
      emit("qa-done", { issues: failed }, failed ? `QA failed: ${failed} issue(s)` : "QA passed");
      return failed ? EXIT.qa : EXIT.ok;
    }
    case "produce": {
      if (!values.prompt) throw new CliError("produce needs --prompt", EXIT.input);
      const r = await produce({
        prompt: values.prompt,
        aspects: (aspects as AspectRatio[] | undefined) ?? ["9:16"],
        out,
        renderer: (values.renderer ?? "hyperframes") as "hyperframes" | "fallback",
        ...(values.duration ? { durationSec: Number(values.duration) } : {}),
        ...(values.style ? { styleId: values.style } : {}),
        ...(values["mix-styles"]
          ? {
              mixStyles: values["mix-styles"]
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean),
            }
          : {}),
        ...(values.voice ? { voiceId: values.voice } : {}),
      });
      return r.status === "ready" ? EXIT.ok : EXIT.qa;
    }
    case "golden": {
      if (!arg) throw new CliError("golden needs <style-id>", EXIT.input);
      if (values.thumbnails) {
        const ids = arg === "all" ? listStyleIds() : [arg];
        for (const id of ids)
          emit(
            "thumbnail",
            { styleId: id, file: await styleThumbnail(id, { out }) },
            `${id}: thumbnail written`,
          );
        await closeSharedBrowser();
        return EXIT.ok;
      }
      const res = await golden(arg, {
        update: !!values.update,
        out,
        allowHost: !!values["allow-host"],
        ...(runtime ? { runtime } : {}),
      });
      const bad = res.filter((r) => r.status === "mismatch" || r.status === "missing");
      emit(
        "golden-done",
        { total: res.length, bad: bad.length },
        bad.length
          ? `golden: ${bad.length}/${res.length} differ or missing`
          : `golden: ${res.length} frames ${values.update ? "written" : "match"}`,
      );
      return bad.length ? EXIT.qa : EXIT.ok;
    }
    default:
      throw new CliError(`unknown command "${cmd}"\n${USAGE}`, EXIT.input);
  }
}

main(process.argv.slice(2)).then(
  (code) => process.exit(code),
  (e: unknown) => {
    const code = e instanceof CliError ? e.code : EXIT.render;
    emit("error", { code, message: (e as Error).message });
    console.error(`error: ${(e as Error).message}`);
    process.exit(code);
  },
);
