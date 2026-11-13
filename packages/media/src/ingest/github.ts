// Public GitHub repository ingest (T114): repository facts, README, latest releases and recent commits from the
// REST API (no scraping). Unauthenticated (60 req/h per IP); GITHUB_TOKEN raises the limit when set.
import { safeFetchText } from "../net/safe-fetch";
import { cleanText, type SourceMaterial, type TextFetcher } from "./types";

const API = "https://api.github.com";

export function parseRepo(input: string): { owner: string; repo: string } {
  const m =
    /^(?:https?:\/\/)?(?:www\.)?github\.com\/([A-Za-z0-9-]{1,39})\/([A-Za-z0-9._-]{1,100})(?:[/?#].*)?$/i.exec(
      input.trim(),
    );
  const short = /^([A-Za-z0-9-]{1,39})\/([A-Za-z0-9._-]{1,100})$/.exec(input.trim());
  const hit = m ?? short;
  if (!hit) throw new Error("not a GitHub repository link");
  return { owner: hit[1]!, repo: hit[2]!.replace(/\.git$/i, "") };
}

const defaultFetcher: TextFetcher = async (url, headers) => {
  const r = await safeFetchText(url, { ...(headers ? { headers } : {}), maxBytes: 2 * 1024 * 1024 });
  return { url: r.url, status: r.status, contentType: r.contentType, text: r.text };
};

/** README without badges, images, HTML and code blocks (they read badly as narration material). */
export function plainReadme(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^\s*\[!\[.*$/gm, "");
}

export async function ingestGithub(
  input: string,
  opts: { fetcher?: TextFetcher; token?: string } = {},
): Promise<SourceMaterial> {
  const { owner, repo } = parseRepo(input);
  const fetcher = opts.fetcher ?? defaultFetcher;
  const token = opts.token ?? process.env.GITHUB_TOKEN;
  const h = {
    accept: "application/vnd.github+json",
    "x-github-api-version": "2022-11-28",
    ...(token ? { authorization: `Bearer ${token}` } : {}),
  };
  const get = async <T>(path: string, accept?: string): Promise<T | null> => {
    const r = await fetcher(`${API}/repos/${owner}/${repo}${path}`, { ...h, ...(accept ? { accept } : {}) });
    if (r.status === 404) return null;
    if (r.status === 403 || r.status === 429) throw new Error("GitHub rate limit reached, try again later");
    if (r.status < 200 || r.status >= 300) throw new Error(`GitHub returned HTTP ${r.status}`);
    return (accept?.includes("raw") ? r.text : JSON.parse(r.text)) as T;
  };
  const info = await get<{
    full_name: string;
    description: string | null;
    stargazers_count: number;
    language: string | null;
    topics?: string[];
    license?: { spdx_id?: string } | null;
    homepage?: string | null;
    private?: boolean;
  }>("");
  if (!info || info.private) throw new Error("repository not found or not public");
  const readme = (await get<string>("/readme", "application/vnd.github.raw")) ?? "";
  const releases =
    (await get<Array<{ name: string | null; tag_name: string; body: string | null; published_at: string }>>(
      "/releases?per_page=3",
    )) ?? [];
  const commits =
    (await get<Array<{ commit: { message: string; author?: { date?: string } } }>>("/commits?per_page=10")) ??
    [];
  const parts = [
    `# ${info.full_name}`,
    info.description ?? "",
    `Ngôn ngữ: ${info.language ?? "—"} · ${info.stargazers_count} sao` +
      (info.topics?.length ? ` · chủ đề: ${info.topics.join(", ")}` : "") +
      (info.license?.spdx_id ? ` · giấy phép ${info.license.spdx_id}` : ""),
    "## README",
    cleanText(plainReadme(readme), 4000),
    ...(releases.length
      ? [
          "## Các bản phát hành gần đây",
          ...releases.map(
            (r) =>
              `### ${r.name || r.tag_name} (${r.published_at.slice(0, 10)})\n${cleanText(plainReadme(r.body ?? ""), 600)}`,
          ),
        ]
      : []),
    ...(commits.length
      ? ["## Thay đổi gần đây", ...commits.map((c) => `- ${c.commit.message.split("\n")[0]}`)]
      : []),
  ];
  return {
    kind: "github",
    title: info.full_name,
    markdown: cleanText(parts.filter(Boolean).join("\n\n")),
    metadata: {
      repo: info.full_name,
      stars: info.stargazers_count,
      language: info.language,
      license: info.license?.spdx_id ?? null,
      latestRelease: releases[0]?.tag_name ?? null,
    },
  };
}
