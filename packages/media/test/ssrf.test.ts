// T109: SSRF protections of safeFetch. A local HTTP server plays the "internet"; a fake resolver maps test
// hostnames to addresses; only the test server address is explicitly allowed in positive cases.
import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { isBlockedAddress, safeFetch, SafeFetchError, type Resolver } from "../src/net/safe-fetch";

let server: Server;
let port = 0;
beforeAll(async () => {
  server = createServer((req, res) => {
    if (req.url === "/redirect-private") {
      res.writeHead(302, { location: "http://10.0.0.5/secret" });
      return void res.end();
    }
    if (req.url === "/redirect-ok") {
      res.writeHead(302, { location: "/hello" });
      return void res.end();
    }
    if (req.url === "/loop") {
      res.writeHead(302, { location: "/loop" });
      return void res.end();
    }
    if (req.url === "/big") {
      res.writeHead(200, { "content-type": "text/plain" });
      return void res.end("x".repeat(2000));
    }
    if (req.url === "/slow") return void setTimeout(() => res.end("late"), 3000);
    res.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
    res.end(`hello from ${req.headers.host}`);
  });
  await new Promise<void>((ok) => server.listen(0, "127.0.0.1", () => ok()));
  const a = server.address();
  port = typeof a === "object" && a ? a.port : 0;
});
afterAll(() => new Promise<void>((ok) => server.close(() => ok())));

/** "public.test" -> the local server; everything else per table. */
const resolver =
  (table: Record<string, string[]>): Resolver =>
  async (host) =>
    (table[host] ?? []).map((address) => ({ address, family: address.includes(":") ? 6 : 4 }));
const onlyTestServer = (ip: string) => ip !== "127.0.0.1" && isBlockedAddress(ip);
const base = () => ({ allowedPorts: [port], isBlocked: onlyTestServer });

async function code(p: Promise<unknown>): Promise<string> {
  try {
    await p;
    return "ok";
  } catch (e) {
    return e instanceof SafeFetchError ? e.code : `other: ${(e as Error).message}`;
  }
}

describe("address policy", () => {
  it.each([
    "127.0.0.1",
    "10.1.2.3",
    "172.16.0.1",
    "192.168.1.1",
    "169.254.169.254",
    "100.64.0.1",
    "0.0.0.0",
    "224.0.0.1",
    "255.255.255.255",
    "::1",
    "::",
    "fe80::1",
    "fd00::1",
    "::ffff:127.0.0.1",
    "::ffff:8.8.8.8",
    "64:ff9b::a00:1",
    "not-an-ip",
  ])("blocks %s", (ip) => expect(isBlockedAddress(ip)).toBe(true));
  it.each(["8.8.8.8", "1.1.1.1", "2606:4700:4700::1111", "203.0.114.1"])("allows public %s", (ip) =>
    expect(isBlockedAddress(ip)).toBe(false),
  );
});

describe("safeFetch", () => {
  it("fetches a public host (pinned to the vetted address)", async () => {
    const r = await safeFetch(`http://public.test:${port}/hello`, {
      ...base(),
      resolve: resolver({ "public.test": ["127.0.0.1"] }),
    });
    expect(r.status).toBe(200);
    expect(r.body.toString()).toBe(`hello from public.test:${port}`);
  });

  it("rejects localhost, private literals and internal names", async () => {
    expect(await code(safeFetch(`http://127.0.0.1:${port}/`, { allowedPorts: [port] }))).toBe(
      "blocked_address",
    );
    expect(await code(safeFetch("http://169.254.169.254/latest/meta-data/"))).toBe("blocked_address");
    expect(await code(safeFetch("http://[::1]/"))).toBe("blocked_address");
    expect(await code(safeFetch("http://localhost/"))).toBe("blocked_address");
    expect(await code(safeFetch("http://metadata.google.internal/"))).toBe("blocked_address");
  });

  it("rejects a hostname with ANY private answer (DNS rebinding with mixed records)", async () => {
    const resolve = resolver({ "rebind.test": ["8.8.8.8", "10.0.0.1"] });
    expect(await code(safeFetch("http://rebind.test/", { resolve }))).toBe("blocked_address");
  });

  it("connects to the vetted address even if DNS would answer differently later", async () => {
    let calls = 0;
    const flip: Resolver = async () => {
      calls++;
      return [{ address: calls === 1 ? "127.0.0.1" : "10.0.0.1", family: 4 }];
    };
    const r = await safeFetch(`http://flip.test:${port}/hello`, { ...base(), resolve: flip });
    expect(r.status).toBe(200);
    expect(calls).toBe(1); // resolved once, connection pinned
  });

  it("re-checks every redirect hop: redirect to a private address is blocked", async () => {
    const resolve = resolver({ "public.test": ["127.0.0.1"] });
    expect(await code(safeFetch(`http://public.test:${port}/redirect-private`, { ...base(), resolve }))).toBe(
      "port", // the hop's default port 80 is outside the allowed ports in this test
    );
    expect(
      await code(
        safeFetch(`http://public.test:${port}/redirect-private`, {
          ...base(),
          allowedPorts: [port, 80],
          resolve,
        }),
      ),
    ).toBe("blocked_address");
    const ok = await safeFetch(`http://public.test:${port}/redirect-ok`, { ...base(), resolve });
    expect(ok.url).toBe(`http://public.test:${port}/hello`);
  });

  it("limits redirects, size and time", async () => {
    const resolve = resolver({ "public.test": ["127.0.0.1"] });
    expect(await code(safeFetch(`http://public.test:${port}/loop`, { ...base(), resolve }))).toBe(
      "too_many_redirects",
    );
    expect(
      await code(safeFetch(`http://public.test:${port}/big`, { ...base(), resolve, maxBytes: 1000 })),
    ).toBe("too_large");
    expect(
      await code(safeFetch(`http://public.test:${port}/slow`, { ...base(), resolve, timeoutMs: 300 })),
    ).toBe("timeout");
  });

  it("rejects non-http schemes, credentials and odd ports", async () => {
    for (const u of [
      "file:///etc/passwd",
      "ftp://example.com/",
      "gopher://example.com/",
      "data:text/plain,hi",
    ])
      expect(await code(safeFetch(u))).toBe("scheme");
    expect(await code(safeFetch("http://user:pass@example.com/"))).toBe("bad_url");
    expect(await code(safeFetch("http://example.com:6379/"))).toBe("port");
    expect(await code(safeFetch("not a url"))).toBe("bad_url");
  });
});
