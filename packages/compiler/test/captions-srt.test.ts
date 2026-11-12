import { describe, expect, it } from "vitest";
import type { Word } from "@makvid/spec";
import { chunkWords, layoutCaptions, parseSrt, srtTime, toSrt } from "../src";

const words = (text: string, startMs = 0, step = 300): Word[] =>
  text.split(" ").map((t, i) => ({
    text: t,
    startMs: startMs + i * step,
    endMs: startMs + i * step + 250,
    scriptId: "s1",
  }));

describe("caption chunking", () => {
  it("never leaves a single orphan word at the end of a sentence", () => {
    const chunks = chunkWords(words("So với lãi đơn, lãi kép tăng nhanh hơn mỗi năm."), 6);
    for (const c of chunks) expect(c.length).toBeGreaterThan(1);
    expect(
      chunks
        .flat()
        .map((w) => w.text)
        .join(" "),
    ).toBe("So với lãi đơn, lãi kép tăng nhanh hơn mỗi năm.");
  });

  it("splits at sentence ends and respects maxWords", () => {
    const chunks = chunkWords(words("Một hai ba. Bốn năm sáu bảy tám chín mười mười một mười hai."), 5);
    expect(chunks[0]!.map((w) => w.text).join(" ")).toBe("Một hai ba.");
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(5);
  });

  it("lays out at most 2 lines per chunk and chains chunk times", () => {
    const measure = (t: string, s: number) => [...t].length * 0.55 * s;
    const style = {
      font: "caption",
      maxFontSize: 52,
      minFontSize: 38,
      lineHeight: 1.25,
      maxWords: 8,
      boxWidth: 0.86,
      bottom: 0.01,
    };
    const out = layoutCaptions(
      words("Gửi mười triệu với lãi tám phần trăm, sau mười năm bạn có hai mươi mốt triệu sáu."),
      style,
      "9:16",
      measure,
      2,
      30_000,
    );
    for (const c of out) expect(c.lines.length).toBeLessThanOrEqual(2);
    for (let i = 0; i + 1 < out.length; i++) expect(out[i]!.endMs).toBe(out[i + 1]!.startMs);
  });
});

describe("SRT", () => {
  it("formats times", () => {
    expect(srtTime(0)).toBe("00:00:00,000");
    expect(srtTime(3_723_045)).toBe("01:02:03,045");
  });

  it("round-trips Vietnamese diacritics (NFC) with CRLF and no BOM", () => {
    const cues = [
      { startMs: 0, endMs: 1500, text: "Ẩn số quan trọng nhất" },
      { startMs: 1500, endMs: 3200, text: "Tiếng Việt có dấu: Ỹ Ự ữ ặ".normalize("NFD") },
    ];
    const srt = toSrt(cues);
    expect(srt.charCodeAt(0)).not.toBe(0xfeff);
    expect(srt).toContain("\r\n");
    const back = parseSrt(srt);
    expect(back).toEqual(cues.map((c) => ({ ...c, text: c.text.normalize("NFC") })));
    expect(Buffer.from(srt, "utf8").toString("utf8")).toBe(srt);
  });

  it("drops empty or zero-length cues", () => {
    expect(
      parseSrt(
        toSrt([
          { startMs: 0, endMs: 0, text: "x" },
          { startMs: 0, endMs: 10, text: " " },
        ]),
      ),
    ).toEqual([]);
  });
});

describe("SRT multi-line cues", () => {
  it("uses CRLF inside two-line cues too", () => {
    const srt = toSrt([{ startMs: 0, endMs: 1000, text: "Dòng một\nDòng hai" }]);
    expect(srt).toContain("Dòng một\r\nDòng hai\r\n");
    expect(srt.replace(/\r\n/g, "")).not.toContain("\n");
  });
});
