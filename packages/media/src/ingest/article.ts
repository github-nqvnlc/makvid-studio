// Article URL ingest (T113): SSRF-safe fetch -> Mozilla Readability (main content only, no menus/ads) on a
// linkedom DOM. Images are listed for reuse ONLY when the page declares an open license (rel=license /
// Creative Commons) and robots.txt does not disallow the path; otherwise no image is taken.
import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";
import { safeFetchText } from "../net/safe-fetch";
import { cleanText, type SourceMaterial, type TextFetcher } from "./types";

const defaultFetcher: TextFetcher = async (url, headers) => {
  const r = await safeFetchText(url, { ...(headers ? { headers } : {}), maxBytes: 4 * 1024 * 1024 });
  return { url: r.url, status: r.status, contentType: r.contentType, text: r.text };
};

/** Minimal robots.txt check for our user agent group or "*": longest matching Allow/Disallow rule wins. */
export function robotsAllows(robots: string, path: string, agent = "makvidstudio"): boolean {
  const groups: Array<{ agents: string[]; rules: Array<{ allow: boolean; path: string }> }> = [];
  let cur: (typeof groups)[number] | undefined;
  let lastWasAgent = false;
  for (const raw of robots.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, "").trim();
    const m = /^([A-Za-z-]+)\s*:\s*(.*)$/.exec(line);
    if (!m) continue;
    const key = m[1]!.toLowerCase();
    const val = m[2]!.trim();
    if (key === "user-agent") {
      if (!cur || !lastWasAgent) groups.push((cur = { agents: [], rules: [] }));
      cur.agents.push(val.toLowerCase());
      lastWasAgent = true;
    } else if ((key === "allow" || key === "disallow") && cur) {
      lastWasAgent = false;
      if (val) cur.rules.push({ allow: key === "allow", path: val });
    }
  }
  const mine = groups.find((g) => g.agents.some((a) => a !== "*" && agent.includes(a)));
  const group = mine ?? groups.find((g) => g.agents.includes("*"));
  if (!group) return true;
  const matches = group.rules.filter((r) => path.startsWith(r.path.replace(/\*.*$/, "")));
  if (!matches.length) return true;
  return matches.sort((a, b) => b.path.length - a.path.length)[0]!.allow;
}

function pageLicense(doc: Document): string | null {
  const link = doc.querySelector('link[rel="license"], a[rel="license"]');
  const href = link?.getAttribute("href") ?? "";
  if (/creativecommons\.org\/(licenses\/(by|by-sa)\/|publicdomain\/zero)/i.test(href)) return href;
  return null;
}

export async function ingestArticle(
  url: string,
  fetcher: TextFetcher = defaultFetcher,
): Promise<SourceMaterial> {
  const page = await fetcher(url, { accept: "text/html,application/xhtml+xml" });
  if (page.status < 200 || page.status >= 300) throw new Error(`page returned HTTP ${page.status}`);
  if (!/html/i.test(page.contentType)) throw new Error("the link is not a web page");
  const { document } = parseHTML(page.text);
  const license = pageLicense(document as unknown as Document);
  const reader = new Readability(document as unknown as Document, { charThreshold: 200 });
  const art = reader.parse();
  if (!art?.textContent || art.textContent.trim().length < 200)
    throw new Error("could not find the main content of the page");
  const title = cleanText(art.title ?? "", 200);
  const body = cleanText((art.textContent ?? "").replace(/\n\s*\n/g, "\n\n"));

  let images: SourceMaterial["images"] = [];
  if (license) {
    const final = new URL(page.url);
    let allowed = true;
    try {
      const robots = await fetcher(new URL("/robots.txt", final).toString());
      if (robots.status >= 200 && robots.status < 300) allowed = robotsAllows(robots.text, final.pathname);
    } catch {
      allowed = true; // no robots.txt reachable: the page license still governs reuse
    }
    if (allowed) {
      const { document: content } = parseHTML(
        `<!doctype html><html><body>${art.content ?? ""}</body></html>`,
      );
      images = Array.from(content.querySelectorAll("img"))
        .map((img) => ({
          url: new URL(img.getAttribute("src") ?? "", final).toString(),
          alt: (img.getAttribute("alt") ?? "").normalize("NFC"),
          license,
        }))
        .filter((i) => /^https?:/.test(i.url))
        .slice(0, 8);
    }
  }
  return {
    kind: "url",
    title,
    markdown: cleanText(`# ${title}\n\n${body}`),
    ...(images.length ? { images } : {}),
    metadata: {
      url: page.url,
      siteName: art.siteName ?? null,
      byline: art.byline ?? null,
      published: art.publishedTime ?? null,
      license,
      length: body.length,
    },
  };
}
