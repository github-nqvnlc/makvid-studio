// Shared headless-Chrome session for the fallback renderer and QA capture.
// The scene directory is served on 127.0.0.1; every other request is blocked and recorded.
import { createReadStream, existsSync, readdirSync, statSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { homedir } from "node:os";
import { extname, join, normalize, resolve } from "node:path";
import puppeteer, { type Browser, type Page } from "puppeteer-core";

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".woff2": "font/woff2",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
};

/** chrome-headless-shell path: env override, else the pinned build in the puppeteer cache. */
export function findChrome(): string {
  const env = process.env.PRODUCER_HEADLESS_SHELL_PATH ?? process.env.CHROME_PATH;
  if (env && existsSync(env)) return env;
  const base = join(homedir(), ".cache", "puppeteer", "chrome-headless-shell");
  if (existsSync(base)) {
    for (const ver of readdirSync(base).sort().reverse()) {
      const dir = join(base, ver);
      for (const sub of readdirSync(dir)) {
        for (const exe of ["chrome-headless-shell.exe", "chrome-headless-shell"]) {
          const p = join(dir, sub, exe);
          if (existsSync(p)) return p;
        }
      }
    }
  }
  throw new Error("chrome-headless-shell not found (set PRODUCER_HEADLESS_SHELL_PATH)");
}

export const CHROME_ARGS = [
  "--headless=new",
  "--no-sandbox",
  "--disable-gpu",
  "--disable-lcd-text",
  "--font-render-hinting=none",
  "--force-color-profile=srgb",
  "--force-device-scale-factor=1",
  "--hide-scrollbars",
  "--mute-audio",
  "--disable-background-timer-throttling",
  "--disable-renderer-backgrounding",
];

export function serveDir(dir: string): Promise<{ server: Server; origin: string }> {
  const root = resolve(dir);
  const server = createServer((req, res) => {
    const url = decodeURIComponent((req.url ?? "/").split("?")[0] ?? "/");
    let file = normalize(join(root, url));
    if (!file.startsWith(root)) return void res.writeHead(403).end();
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
    if (!existsSync(file)) return void res.writeHead(404).end();
    res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" });
    createReadStream(file).pipe(res);
  });
  return new Promise((ok) =>
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      ok({ server, origin: `http://127.0.0.1:${typeof addr === "object" && addr ? addr.port : 0}` });
    }),
  );
}

let shared: Promise<Browser> | null = null;
export function sharedBrowser(): Promise<Browser> {
  shared ??= puppeteer.launch({ executablePath: findChrome(), args: CHROME_ARGS, headless: true });
  return shared;
}
export async function closeSharedBrowser(): Promise<void> {
  if (shared) {
    const b = await shared;
    shared = null;
    await b.close();
  }
}

export interface ScenePage {
  page: Page;
  blocked: string[];
  duration: number;
  seek(t: number): Promise<void>;
  close(): Promise<void>;
}

/**
 * Open a compiled scene without the HyperFrames runtime (stubbed), so this path is independent of it.
 * Time is driven only through window.__timelines.main.seek(t).
 */
export async function openScene(sceneDir: string, width: number, height: number): Promise<ScenePage> {
  const { server, origin } = await serveDir(sceneDir);
  const browser = await sharedBrowser();
  const page = await browser.newPage();
  const blocked: string[] = [];
  await page.setViewport({ width, height, deviceScaleFactor: 1 });
  // Functions passed to page.evaluate may carry esbuild's keepNames helper (`__name`) when run via tsx.
  await page.evaluateOnNewDocument("globalThis.__name = globalThis.__name || ((f) => f);");
  await page.setRequestInterception(true);
  page.on("request", (req) => {
    const url = req.url();
    if (url.startsWith("data:")) return void req.continue();
    if (!url.startsWith(origin + "/")) {
      blocked.push(url);
      return void req.abort("blockedbyclient");
    }
    if (url.endsWith("/hyperframe.runtime.iife.js"))
      return void req.respond({
        status: 200,
        contentType: "text/javascript",
        body: "/* runtime stubbed by fallback renderer */",
      });
    req.continue();
  });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(`${origin}/index.html`, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  await page.waitForFunction(
    () => !!(window as unknown as { __timelines?: { main?: unknown } }).__timelines?.main,
    { timeout: 15000 },
  );
  if (errors.length) throw new Error(`scene script error: ${errors.join("; ")}`);
  const duration = await page.evaluate(() => {
    const tl = (window as unknown as { __timelines: { main: { duration(): number } } }).__timelines.main;
    return tl.duration();
  });
  return {
    page,
    blocked,
    duration,
    async seek(t: number) {
      await page.evaluate((time) => {
        const tl = (
          window as unknown as { __timelines: { main: { seek(t: number, suppress?: boolean): unknown } } }
        ).__timelines.main;
        tl.seek(time, false);
      }, t);
    },
    async close() {
      await page.close();
      await new Promise<void>((ok) => server.close(() => ok()));
    },
  };
}
