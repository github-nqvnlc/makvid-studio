// GET /api/v1/styles: style packs (id, bilingual name and description).
import { styleCards } from "@/server/catalog";
import { apiHandler } from "@/server/public-api";

export const dynamic = "force-dynamic";

export function GET(req: Request) {
  return apiHandler(req, "videos:read", async () => {
    const vi = styleCards("vi");
    const en = styleCards("en");
    return Response.json({
      styles: vi.map((s) => {
        const e = en.find((x) => x.id === s.id);
        return {
          id: s.id,
          name: { vi: s.name, en: e?.name ?? s.name },
          description: { vi: s.description, en: e?.description ?? s.description },
        };
      }),
    });
  });
}
