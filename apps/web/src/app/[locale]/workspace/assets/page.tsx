import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { listAssets } from "@/server/assets";
import { viewer } from "@/server/session";

export const dynamic = "force-dynamic";

export default async function AssetsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const v = await viewer();
  if (!v) return redirect({ href: "/sign-in", locale });
  const t = await getTranslations("assets");
  const items = await listAssets(v.workspaceId);
  const kb = (n: number) => `${Math.max(1, Math.round(n / 1024))} KB`;
  return (
    <section className="stack">
      <h1>{t("title")}</h1>
      <p className="muted small">{t("hint")}</p>
      <div className="card">
        {items.length === 0 ? (
          <p className="muted">{t("empty")}</p>
        ) : (
          <ul className="list" data-testid="asset-list">
            {items.map((a) => (
              <li key={a.id}>
                <span className="row">
                  {a.url ? (
                    <img src={a.url} alt="" style={{ height: 36, width: 64, objectFit: "contain" }} />
                  ) : (
                    <span className="badge">{t("font")}</span>
                  )}
                  {a.family ? `${a.family} · ${a.weight}` : a.name}
                </span>
                <span className="muted small">{kb(a.bytes)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
