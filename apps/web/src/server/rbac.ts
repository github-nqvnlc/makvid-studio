// Workspace roles (US6, T136; FR-047): Owner / Admin / Editor / Viewer. One matrix decides every action, and
// every route handler names the action it needs (ROUTES), so the permission table is reviewable in one place.
import type { Role } from "@makvid/db";

export type Action =
  | "view" // projects, batches, templates, usage
  | "download"
  | "create" // new videos, chat edits, review, duplicate, restore
  | "batch" // templates + batches
  | "assets" // upload to the asset library
  | "brand"
  | "members" // invite, change roles, remove (never the owner)
  | "api" // API keys, webhooks
  | "billing"; // plans, checkout, credits

const MATRIX: Record<Role, ReadonlySet<Action>> = {
  viewer: new Set(["view", "download"]),
  editor: new Set(["view", "download", "create", "batch", "assets"]),
  admin: new Set(["view", "download", "create", "batch", "assets", "brand", "members", "api"]),
  owner: new Set(["view", "download", "create", "batch", "assets", "brand", "members", "api", "billing"]),
};

export function can(role: Role, action: Action): boolean {
  return MATRIX[role].has(action);
}

/** Roles a member with `actor` may give or take away (owners are never changed this way). */
export function assignableRoles(actor: Role): Role[] {
  return actor === "owner" ? ["admin", "editor", "viewer"] : actor === "admin" ? ["editor", "viewer"] : [];
}

/** Permission needed by each route handler ("METHOD path"). */
export const ROUTES = {
  "GET /api/projects": "view",
  "POST /api/projects": "create",
  "GET /api/projects/[id]": "view",
  "DELETE /api/projects/[id]": "create",
  "POST /api/projects/[id]/actions": "create",
  "POST /api/projects/[id]/chat": "create",
  "GET /api/projects/[id]/events": "view",
  "POST /api/projects/[id]/review": "create",
  "GET /api/projects/[id]/previews/[sceneId]": "view",
  "GET /api/assets": "view",
  "POST /api/assets": "assets",
  "GET /api/brand": "view",
  "PUT /api/brand": "brand",
  "GET /api/templates": "view",
  "POST /api/templates": "batch",
  "GET /api/batches": "view",
  "POST /api/batches": "batch",
  "POST /api/batches/check": "batch",
  "GET /api/batches/[id]": "view",
  "POST /api/batches/[id]/retry": "batch",
  "POST /api/batches/[id]/cancel": "batch",
  "POST /api/batches/[id]/resume": "batch",
  "GET /api/workspace/members": "view",
  "POST /api/workspace/invitations": "members",
  "DELETE /api/workspace/invitations/[id]": "members",
  "PATCH /api/workspace/members/[userId]": "members",
  "DELETE /api/workspace/members/[userId]": "members",
  "GET /api/workspace/usage": "view",
  "POST /api/billing/checkout": "billing",
  "GET /api/workspace/api-keys": "api",
  "POST /api/workspace/api-keys": "api",
  "DELETE /api/workspace/api-keys/[id]": "api",
  "GET /api/workspace/webhooks": "api",
  "POST /api/workspace/webhooks": "api",
  "DELETE /api/workspace/webhooks/[id]": "api",
} as const satisfies Record<string, Action>;
export type RouteKey = keyof typeof ROUTES;
