import { ImageIcon } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { EmptyState } from "@/components/common/EmptyState";
import { PageHeader } from "@/components/common/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <PageHeader title={t("title")} description={t("hint")} />
      {items.length === 0 ? (
        <EmptyState icon={ImageIcon} title={t("empty")} />
      ) : (
        <Card>
          <CardContent>
            <ul className="divide-y" data-testid="asset-list">
              {items.map((a) => (
                <li key={a.id} className="flex items-center gap-3 py-3">
                  {a.url ? (
                    <img src={a.url} alt="" className="h-9 w-16 object-contain" />
                  ) : (
                    <Badge variant="secondary">{t("font")}</Badge>
                  )}
                  <span className="min-w-0 flex-1 truncate">{a.family ? `${a.family} · ${a.weight}` : a.name}</span>
                  <span className="text-muted-foreground text-sm">{kb(a.bytes)}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
