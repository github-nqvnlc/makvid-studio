import { describe, expect, it } from "vitest";
import vi from "../messages/vi.json" with { type: "json" };
import en from "../messages/en.json" with { type: "json" };
import { ERROR_CODES, FORBIDDEN_TECH_TERMS, toUserFacing, UserFacingError } from "../src";

describe("UserFacingError", () => {
  it("every code has vi and en message + hint", () => {
    for (const code of ERROR_CODES)
      for (const m of [vi, en]) {
        const e = (m.errors as Record<string, { message: string; hint: string }>)[code];
        expect(e?.message, code).toBeTruthy();
        expect(e?.hint, code).toBeTruthy();
      }
  });

  it("user-facing text never contains technology names", () => {
    for (const m of [vi, en]) {
      const text = JSON.stringify(m).toLowerCase();
      for (const term of FORBIDDEN_TECH_TERMS) expect(text, term).not.toMatch(new RegExp(`\b${term}\b`));
    }
  });

  it("keeps internal detail out of the client payload", () => {
    const e = new UserFacingError("RENDER_FAILED", "HyperFrames executeRenderJob: ENOENT frame_000119.jpg");
    const client = JSON.stringify(e.toClient("vi"));
    expect(client).not.toMatch(/hyperframes|enoent|frame_/i);
    expect(e.toClient("vi").message).toBe("Chưa xuất được video.");
    expect(e.httpStatus).toBe(500);
  });

  it("fills params and wraps unknown errors as INTERNAL", () => {
    expect(
      new UserFacingError("SLOT_TOO_LONG", undefined, { slot: "Tiêu đề", max: 56 }).toClient("vi").message,
    ).toBe('Đoạn chữ "Tiêu đề" dài quá 56 ký tự.');
    const w = toUserFacing(new TypeError("Cannot read properties of undefined"));
    expect(w.code).toBe("INTERNAL");
    expect(JSON.stringify(w.toClient("en"))).not.toMatch(/undefined|TypeError/);
  });
});
