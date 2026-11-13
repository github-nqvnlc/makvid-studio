// GET /api/v1/openapi.yaml: the public API contract (no key needed).
import { openApiText } from "@/server/openapi";

export const dynamic = "force-static";

export function GET() {
  return new Response(openApiText(), {
    headers: { "content-type": "application/yaml; charset=utf-8", "cache-control": "public, max-age=300" },
  });
}
