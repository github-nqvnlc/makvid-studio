// Activity log (spec 003): allow-listed text, localization without technical names, stage states.
import { describe, expect, it } from "vitest";
import { isLogKey, LOG_MESSAGES, logText, stageStates, toLogStage } from "../src/events";
import { PROGRESS_MESSAGES } from "../src/messages";

const TECH = /hyperframes|gsap|ffmpeg|chrome|puppeteer|fpt|openai|bullmq|postgres|redis|stack|exception/i;

describe("log messages", () => {
  it("accepts only known keys", () => {
    expect(isLogKey("progress.renderScene")).toBe(true);
    expect(isLogKey("log.start.script")).toBe(true);
    expect(isLogKey("log.approval.needed.storyboard")).toBe(true);
    expect(isLogKey("Error: connect ECONNREFUSED 10.0.0.1")).toBe(false);
  });

  it("localizes with params and keeps Vietnamese diacritics (NFC)", () => {
    expect(logText("progress.renderScene", { current: 3, total: 8 }, "vi")).toBe("Đang dựng cảnh 3/8");
    expect(logText("progress.renderScene", { current: 3, total: 8 }, "en")).toBe("Rendering scene 3/8");
    const t = logText("log.approval.needed.script", {}, "vi");
    expect(t).toBe(t.normalize("NFC"));
    expect(t).toContain("duyệt");
  });

  it("never returns the raw key and has the same keys in both languages", () => {
    expect(logText("not.a.key", {}, "vi")).not.toContain("not.a.key");
    expect(Object.keys(LOG_MESSAGES.vi).sort()).toEqual(Object.keys(LOG_MESSAGES.en).sort());
  });

  it("names no technology or provider", () => {
    for (const l of ["vi", "en"] as const)
      for (const text of [...Object.values(LOG_MESSAGES[l]), ...Object.values(PROGRESS_MESSAGES[l])])
        expect(text).not.toMatch(TECH);
  });
});

describe("stageStates", () => {
  const ev = (stage: string, kind: string) => ({ stage, kind });
  const of = (rows: { stage: string; kind: string }[], status: string) =>
    Object.fromEntries(stageStates(rows, status).map((s) => [s.stage, s.state]));

  it("starts with everything waiting", () => {
    expect(Object.values(of([], "draft")).every((s) => s === "waiting")).toBe(true);
  });

  it("running, done, and earlier stages without entries count as done", () => {
    const s = of([ev("script", "stage_start"), ev("script", "stage_done"), ev("audio", "stage_start")], "producing_audio");
    expect(s).toMatchObject({ script: "done", style: "done", storyboard: "done", audio: "running", qa: "waiting" });
  });

  it("maps the preview step to storyboard and marks approvals", () => {
    expect(toLogStage("preview")).toBe("storyboard");
    const s = of([ev("script", "approval_needed")], "awaiting_script_review");
    expect(s.script).toBe("needs_approval");
    const t = of([ev("storyboard", "approval_needed")], "awaiting_storyboard_review");
    expect(t.storyboard).toBe("needs_approval");
  });

  it("marks the failed stage and a retry as running again", () => {
    expect(of([ev("audio", "stage_start"), ev("audio", "error")], "failed").audio).toBe("failed");
    expect(of([ev("audio", "error"), ev("audio", "retry")], "producing_audio").audio).toBe("running");
  });

  it("is all done when the project is ready", () => {
    expect(Object.values(of([ev("render", "done")], "ready")).every((s) => s === "done")).toBe(true);
  });
});
