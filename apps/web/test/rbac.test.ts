// T136: role permission matrix (owner/admin/editor/viewer) and route coverage: every API route handler that
// uses a session checks the right permission, named in rbac.ts ROUTES.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";
import { assignableRoles, can, ROUTES, type Action } from "@/server/rbac";
import { MAX_FREE_SIGNUPS, shouldBlock } from "@/server/abuse";

const ROLES = ["owner", "admin", "editor", "viewer"] as const;
// Expected matrix, written out by hand (the source of truth for the product owner).
const EXPECTED: Record<Action, Array<(typeof ROLES)[number]>> = {
  view: ["owner", "admin", "editor", "viewer"],
  download: ["owner", "admin", "editor", "viewer"],
  create: ["owner", "admin", "editor"],
  batch: ["owner", "admin", "editor"],
  assets: ["owner", "admin", "editor"],
  brand: ["owner", "admin"],
  members: ["owner", "admin"],
  api: ["owner", "admin"],
  billing: ["owner"],
};

describe("role matrix", () => {
  for (const [action, roles] of Object.entries(EXPECTED) as Array<[Action, string[]]>)
    it(`${action}: ${roles.join(", ")}`, () => {
      for (const r of ROLES) expect(can(r, action)).toBe(roles.includes(r));
    });

  it("a viewer can never edit, run batches, invite, manage keys or pay", () => {
    for (const [route, action] of Object.entries(ROUTES))
      if (!route.startsWith("GET")) expect(can("viewer", action), route).toBe(false);
  });

  it("owners assign admin/editor/viewer; admins only editor/viewer; others nobody", () => {
    expect(assignableRoles("owner")).toEqual(["admin", "editor", "viewer"]);
    expect(assignableRoles("admin")).toEqual(["editor", "viewer"]);
    expect(assignableRoles("editor")).toEqual([]);
    expect(assignableRoles("viewer")).toEqual([]);
  });
});

/** All route.ts files under src/app/api, with their exported methods and guarded(...) keys. */
function routes() {
  const root = join(__dirname, "..", "src", "app", "api");
  const out: Array<{ path: string; method: string; key: string | null; body: string }> = [];
  const walk = (d: string) => {
    for (const n of readdirSync(d)) {
      const p = join(d, n);
      if (statSync(p).isDirectory()) walk(p);
      else if (n === "route.ts") {
        const src = readFileSync(p, "utf8");
        const path = `/api/${relative(root, d).split(sep).join("/")}`;
        const chunks = src.split(/export (?:async )?function /).slice(1);
        for (const c of chunks) {
          const method = /^(GET|POST|PUT|PATCH|DELETE)\b/.exec(c)?.[1];
          if (!method) continue;
          const key = /guarded\(\s*"([^"]+)"/.exec(c)?.[1] ?? null;
          out.push({ path, method, key, body: c });
        }
      }
    }
  };
  walk(root);
  return out;
}
// Routes without a session on purpose: auth, provider webhooks, public API (API-key auth), public assets,
// health (status only) and metrics (METRICS_TOKEN).
const PUBLIC = [
  /^\/api\/(health|metrics)$/,
  /^\/api\/auth\//,
  /^\/api\/billing\/webhooks\//,
  /^\/api\/v1\//,
  /^\/api\/styles\//,
  /^\/api\/voices\//,
];
// Routes that check rights themselves (any member, or a narrower inline check).
const SELF_CHECKED = new Set([
  "POST /api/invitations/accept",
  "POST /api/workspace/switch",
  "DELETE /api/workspace/members/[userId]",
  "GET /api/billing/mock-checkout",
  "POST /api/billing/mock-checkout",
  // platform admin only (viewer.isPlatformAdmin), not a workspace role
  "PATCH /api/admin/plans/[id]",
  "POST /api/admin/grant",
]);

describe("route coverage", () => {
  const all = routes();

  it("finds the route handlers", () => {
    expect(all.length).toBeGreaterThan(20);
  });

  it("every session route names its own permission key", () => {
    for (const r of all) {
      const id = `${r.method} ${r.path}`;
      if (PUBLIC.some((p) => p.test(r.path)) || SELF_CHECKED.has(id)) continue;
      expect(r.key, `${id} must call guarded("${id}", ...)`).toBe(id);
      expect(Object.keys(ROUTES), id).toContain(id);
    }
  });

  it("self-checked routes still require a session; admin routes check the platform-admin flag", () => {
    for (const r of all.filter((x) => SELF_CHECKED.has(`${x.method} ${x.path}`)))
      expect(r.body, `${r.method} ${r.path}`).toMatch(/guarded\(/);
    const admin = all.filter((x) => x.path.startsWith("/api/admin/"));
    expect(admin.length).toBe(2);
    for (const r of admin)
      expect(r.body, `${r.method} ${r.path}`).toMatch(
        /if \(!v\.isPlatformAdmin\) return fail\("forbidden"\)/,
      );
  });
});

describe("free-plan abuse rule", () => {
  it("blocks disposable domains and repeated sign-ups from one IP or device", () => {
    expect(shouldBlock({ emailDomain: "gmail.com", sameIp: 0, sameDevice: 0 })).toBe(false);
    expect(shouldBlock({ emailDomain: "mailinator.com", sameIp: 0, sameDevice: 0 })).toBe(true);
    expect(shouldBlock({ emailDomain: "gmail.com", sameIp: MAX_FREE_SIGNUPS, sameDevice: 0 })).toBe(true);
    expect(shouldBlock({ emailDomain: "gmail.com", sameIp: 1, sameDevice: MAX_FREE_SIGNUPS })).toBe(true);
  });
});
