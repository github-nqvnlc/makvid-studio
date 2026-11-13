// T110: ingest per source kind with fixtures in fixtures/sources (no network).
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ingestArticle,
  ingestGithub,
  ingestScript,
  ingestTable,
  parseCsv,
  parseNumber,
  parseRepo,
  robotsAllows,
  splitSentences,
  type TextFetcher,
} from "../src";

const fx = (f: string) => readFileSync(join(resolve(__dirname, "../../../fixtures/sources"), f), "utf8");

describe("written script", () => {
  it("keeps the narration verbatim after NFC and only splits sentences", () => {
    const raw = fx("script-vi.txt");
    const s = ingestScript(raw.normalize("NFD"));
    expect(s.kind).toBe("script");
    expect(s.sentences).toHaveLength(5);
    expect(s.sentences!.join(" ")).toBe(raw.normalize("NFC").replace(/\s+/g, " ").trim());
    expect(s.sentences![2]).toBe(
      "Hãy thử đặt điện thoại xa giường ngủ, bật chế độ thang độ xám, và tắt thông báo không cần thiết.",
    );
  });
  it("does not split inside numbers or versions", () => {
    expect(splitSentences("Giá tăng 3.5 phần trăm. Phiên bản v2.0 ra mắt!")).toEqual([
      "Giá tăng 3.5 phần trăm.",
      "Phiên bản v2.0 ra mắt!",
    ]);
  });
});

describe("table", () => {
  it("parses quoted CSV with semicolons and Vietnamese decimal commas; chart values equal the file", () => {
    expect(parseCsv('a;b\n1;"x; y"\n')).toEqual([
      ["a", "b"],
      ["1", "x; y"],
    ]);
    const s = ingestTable(fx("gia-vang.csv"), { title: "Giá vàng 2026" });
    expect(s.seriesName).toBe("Giá vàng (triệu đồng/lượng)");
    expect(s.series).toEqual([
      { label: "01/2026", value: 82.5 },
      { label: "02/2026", value: 84.1 },
      { label: "03/2026", value: 83.7 },
      { label: "04/2026", value: 86.2 },
      { label: "05/2026", value: 88.9 },
      { label: "06/2026", value: 91.4 },
    ]);
    expect(s.markdown).toContain("05/2026: 88.9");
  });
  it("reads English formats and JSON arrays", () => {
    expect(parseNumber("1,234.5", false)).toBe(1234.5);
    expect(parseNumber("1.234,5", true)).toBe(1234.5);
    expect(parseNumber("12%", false)).toBe(12);
    expect(parseNumber("abc", false)).toBeNull();
    const s = ingestTable(
      JSON.stringify([
        { year: "2024", users: 1200 },
        { year: "2025", users: 3400.5 },
      ]),
    );
    expect(s.series).toEqual([
      { label: "2024", value: 1200 },
      { label: "2025", value: 3400.5 },
    ]);
  });
});

describe("article", () => {
  const html = fx("article-vi.html");
  const fetcher =
    (robots: string | null): TextFetcher =>
    async (url) =>
      url.endsWith("/robots.txt")
        ? { url, status: robots === null ? 404 : 200, contentType: "text/plain", text: robots ?? "" }
        : { url, status: 200, contentType: "text/html; charset=utf-8", text: html };

  it("keeps only the main content (no menu, ads or footer)", async () => {
    const s = await ingestArticle("https://bao.example/kinh-te/gia-vang", fetcher(null));
    expect(s.kind).toBe("url");
    expect(s.title).toContain("Giá vàng tăng mạnh trong tuần qua");
    expect(s.markdown).toContain("chia nhỏ số vốn");
    for (const junk of ["Thể thao", "Quảng cáo", "Liên hệ quảng cáo", "0123 456 789"])
      expect(s.markdown).not.toContain(junk);
  });
  it("takes images only when the page is openly licensed and robots.txt allows the path", async () => {
    const allowed = await ingestArticle(
      "https://bao.example/kinh-te/gia-vang",
      fetcher("User-agent: *\nAllow: /\n"),
    );
    expect(allowed.images).toEqual([
      {
        url: "https://bao.example/images/vang-mieng.jpg",
        alt: "Vàng miếng tại một cửa hàng",
        license: "https://creativecommons.org/licenses/by/4.0/",
      },
    ]);
    const blocked = await ingestArticle(
      "https://bao.example/kinh-te/gia-vang",
      fetcher("User-agent: *\nDisallow: /kinh-te/\n"),
    );
    expect(blocked.images).toBeUndefined();
    const unlicensed: TextFetcher = async (url) => ({
      url,
      status: 200,
      contentType: "text/html",
      text: html.replace(/<link rel="license"[^>]*>/, ""),
    });
    expect((await ingestArticle("https://bao.example/a", unlicensed)).images).toBeUndefined();
  });
  it("robots rules: specific agent group, longest match wins", () => {
    const r = "User-agent: *\nDisallow: /private\n\nUser-agent: makvidstudio\nDisallow: /\nAllow: /news\n";
    expect(robotsAllows(r, "/news/a")).toBe(true);
    expect(robotsAllows(r, "/other")).toBe(false);
    expect(robotsAllows("User-agent: *\nDisallow: /private\n", "/news")).toBe(true);
  });
});

describe("github", () => {
  it("parses repository links", () => {
    expect(parseRepo("https://github.com/example-org/clip-maker/tree/main")).toEqual({
      owner: "example-org",
      repo: "clip-maker",
    });
    expect(parseRepo("example-org/clip-maker.git")).toEqual({ owner: "example-org", repo: "clip-maker" });
    expect(() => parseRepo("https://gitlab.com/a/b")).toThrow();
  });
  it("summarises repo facts, README (no badges/code), releases and commits from the REST API", async () => {
    const seen: string[] = [];
    const fetcher: TextFetcher = async (url, headers) => {
      seen.push(`${url} ${headers?.accept}`);
      const path = new URL(url).pathname.replace("/repos/example-org/clip-maker", "");
      const body =
        path === ""
          ? fx("github/repo.json")
          : path === "/readme"
            ? fx("github/readme.md")
            : path === "/releases"
              ? fx("github/releases.json")
              : fx("github/commits.json");
      return { url, status: 200, contentType: "application/json", text: body };
    };
    const s = await ingestGithub("https://github.com/example-org/clip-maker", { fetcher, token: "" });
    expect(s.kind).toBe("github");
    expect(s.markdown).toContain("Tạo video ngắn từ văn bản");
    expect(s.markdown).toContain("Render nhanh gấp 3 lần");
    expect(s.markdown).toContain("feat: add 4:5 aspect ratio");
    expect(s.markdown).not.toContain("img.shields.io");
    expect(s.markdown).not.toContain("npm install");
    expect(s.metadata.latestRelease).toBe("v2.0.0");
    expect(seen.every((u) => u.startsWith("https://api.github.com/repos/example-org/clip-maker"))).toBe(true);
    expect(seen.some((u) => u.includes("/readme application/vnd.github.raw"))).toBe(true);
  });
});
