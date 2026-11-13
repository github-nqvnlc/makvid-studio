// SSRF-safe fetch for user-supplied URLs (T111, constitution VII). Every hop:
//   1. only http/https on ports 80/443 (configurable), no credentials in the URL;
//   2. resolve the host once and reject if ANY address is private, loopback, link-local, multicast,
//      reserved, CGNAT, cloud metadata, IPv4-mapped/ULA IPv6...;
//   3. connect to exactly that vetted address (pinned lookup: no second DNS answer -> no DNS rebinding);
//   4. redirects are followed manually (max 5) and re-checked from step 1;
//   5. response size and total time are capped.
import { lookup as dnsLookup } from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import { BlockList, isIP } from "node:net";

export class SafeFetchError extends Error {
  constructor(
    readonly code:
      | "bad_url"
      | "scheme"
      | "port"
      | "blocked_address"
      | "dns"
      | "too_many_redirects"
      | "too_large"
      | "timeout"
      | "http_status"
      | "network",
    message: string,
  ) {
    super(message);
    this.name = "SafeFetchError";
  }
}

const BLOCKED = new BlockList();
for (const [net, prefix] of [
  ["0.0.0.0", 8], // "this" network
  ["10.0.0.0", 8],
  ["100.64.0.0", 10], // CGNAT
  ["127.0.0.0", 8],
  ["169.254.0.0", 16], // link-local incl. 169.254.169.254 cloud metadata
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24], // TEST-NET-1
  ["192.88.99.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15], // benchmarking
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4], // multicast
  ["240.0.0.0", 4], // reserved + broadcast
] as const)
  BLOCKED.addSubnet(net, prefix, "ipv4");
for (const [net, prefix] of [
  ["::", 128],
  ["::1", 128],
  ["64:ff9b::", 96], // NAT64
  ["100::", 64], // discard
  ["2001::", 23], // IETF protocol assignments (Teredo, ORCHID...)
  ["2001:db8::", 32], // documentation
  ["2002::", 16], // 6to4
  ["fc00::", 7], // unique local
  ["fe80::", 10], // link-local
  ["fec0::", 10], // site-local (deprecated)
  ["ff00::", 8], // multicast
] as const)
  BLOCKED.addSubnet(net, prefix, "ipv6");

/** True when the address must never be fetched on behalf of a user. */
export function isBlockedAddress(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) return BLOCKED.check(ip, "ipv4");
  if (v === 6) {
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(ip);
    if (mapped) return true; // never connect to v4-mapped addresses (not in BLOCKED: Node matches IPv4 against ::ffff:0:0/96)
    return BLOCKED.check(ip, "ipv6");
  }
  return true; // not an IP at all
}

export type Resolver = (host: string) => Promise<Array<{ address: string; family: 4 | 6 }>>;
const systemResolver: Resolver = async (host) =>
  (await dnsLookup(host, { all: true, verbatim: true })).map((a) => ({
    address: a.address,
    family: a.family === 6 ? 6 : 4,
  }));

export interface SafeFetchOptions {
  maxBytes?: number; // default 5 MB
  timeoutMs?: number; // whole request incl. redirects, default 15 s
  maxRedirects?: number; // default 5
  headers?: Record<string, string>;
  allowedPorts?: number[]; // default [80, 443]
  /** DNS resolution (tests inject one to simulate rebinding / private answers). */
  resolve?: Resolver;
  /** Address policy (tests may allow a loopback test server explicitly). */
  isBlocked?: (ip: string) => boolean;
}

export interface SafeResponse {
  url: string; // final URL after redirects
  status: number;
  contentType: string;
  headers: Record<string, string | string[] | undefined>;
  body: Buffer;
}

const USER_AGENT = "MakVidStudio/1.0 (+content import)";

async function vet(u: URL, o: Required<Pick<SafeFetchOptions, "allowedPorts">> & SafeFetchOptions) {
  if (u.protocol !== "http:" && u.protocol !== "https:")
    throw new SafeFetchError("scheme", `scheme "${u.protocol}" is not allowed`);
  if (u.username || u.password) throw new SafeFetchError("bad_url", "credentials in URLs are not allowed");
  const port = Number(u.port || (u.protocol === "https:" ? 443 : 80));
  if (!o.allowedPorts.includes(port)) throw new SafeFetchError("port", `port ${port} is not allowed`);
  const host = u.hostname.replace(/^\[|\]$/g, "");
  const blocked = o.isBlocked ?? isBlockedAddress;
  let addrs: Array<{ address: string; family: 4 | 6 }>;
  if (isIP(host)) addrs = [{ address: host, family: isIP(host) === 6 ? 6 : 4 }];
  else {
    if (/^(localhost|.*\.localhost|.*\.local|.*\.internal)$/i.test(host))
      throw new SafeFetchError("blocked_address", `host "${host}" is internal`);
    try {
      addrs = await (o.resolve ?? systemResolver)(host);
    } catch {
      throw new SafeFetchError("dns", `cannot resolve "${host}"`);
    }
  }
  if (!addrs.length) throw new SafeFetchError("dns", `no address for "${host}"`);
  const bad = addrs.find((a) => blocked(a.address));
  if (bad) throw new SafeFetchError("blocked_address", `"${host}" resolves to a blocked address`);
  return { port, address: addrs[0]! };
}

function requestOnce(
  u: URL,
  pinned: { address: string; family: 4 | 6 },
  port: number,
  o: SafeFetchOptions,
  signal: AbortSignal,
): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: Buffer }> {
  const maxBytes = o.maxBytes ?? 5 * 1024 * 1024;
  const mod = u.protocol === "https:" ? https : http;
  return new Promise((ok, fail) => {
    const req = mod.request(
      {
        protocol: u.protocol,
        hostname: u.hostname.replace(/^\[|\]$/g, ""),
        port,
        path: `${u.pathname}${u.search}`,
        method: "GET",
        headers: { "user-agent": USER_AGENT, accept: "*/*", ...o.headers },
        signal,
        // Pin the connection to the vetted address; TLS still verifies the hostname (SNI + cert).
        lookup: (_host, opts, cb) => {
          const all = (opts as { all?: boolean }).all;
          if (all) (cb as (e: null, a: Array<{ address: string; family: number }>) => void)(null, [pinned]);
          else (cb as (e: null, a: string, f: number) => void)(null, pinned.address, pinned.family);
        },
      },
      (res) => {
        const declared = Number(res.headers["content-length"] ?? 0);
        if (declared > maxBytes) {
          res.destroy();
          return fail(new SafeFetchError("too_large", `response is ${declared} bytes (max ${maxBytes})`));
        }
        const chunks: Buffer[] = [];
        let size = 0;
        res.on("data", (c: Buffer) => {
          size += c.length;
          if (size > maxBytes) {
            res.destroy();
            fail(new SafeFetchError("too_large", `response exceeds ${maxBytes} bytes`));
          } else chunks.push(c);
        });
        res.on("end", () =>
          ok({ status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(chunks) }),
        );
        res.on("error", (e) => fail(new SafeFetchError("network", e.message)));
      },
    );
    req.on("error", (e) =>
      fail(
        signal.aborted
          ? new SafeFetchError("timeout", "request timed out")
          : new SafeFetchError("network", e.message),
      ),
    );
    req.end();
  });
}

export async function safeFetch(url: string, opts: SafeFetchOptions = {}): Promise<SafeResponse> {
  const o = { allowedPorts: [80, 443], ...opts };
  const maxRedirects = o.maxRedirects ?? 5;
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), o.timeoutMs ?? 15_000);
  try {
    let current: URL;
    try {
      current = new URL(url);
    } catch {
      throw new SafeFetchError("bad_url", "invalid URL");
    }
    for (let hop = 0; ; hop++) {
      const { port, address } = await vet(current, o);
      const r = await requestOnce(current, address, port, o, ac.signal);
      if ([301, 302, 303, 307, 308].includes(r.status) && r.headers.location) {
        if (hop >= maxRedirects) throw new SafeFetchError("too_many_redirects", "too many redirects");
        current = new URL(r.headers.location, current);
        continue;
      }
      return {
        url: current.toString(),
        status: r.status,
        contentType: String(r.headers["content-type"] ?? ""),
        headers: r.headers,
        body: r.body,
      };
    }
  } catch (e) {
    if (ac.signal.aborted && !(e instanceof SafeFetchError && e.code !== "network"))
      throw new SafeFetchError("timeout", "request timed out");
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

/** safeFetch + 2xx check + UTF-8 text. */
export async function safeFetchText(
  url: string,
  opts: SafeFetchOptions = {},
): Promise<SafeResponse & { text: string }> {
  const r = await safeFetch(url, opts);
  if (r.status < 200 || r.status >= 300) throw new SafeFetchError("http_status", `HTTP ${r.status}`);
  return { ...r, text: r.body.toString("utf8") };
}
