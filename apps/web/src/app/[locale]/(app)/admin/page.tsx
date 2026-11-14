// Platform admin area: only users flagged is_platform_admin (set by an operator in SQL).
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHeader } from "@/components/common/PageHeader";
import { AdminPlans, GrantPlan } from "@/components/AdminPlans";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { redirect } from "@/i18n/navigation";
import { adminCostByStep, adminPlans, adminUsers, adminWorkspaces, queueHealth } from "@/server/admin";
import { viewer } from "@/server/session";

export const dynamic = "force-dynamic";

const usd = (n: number) => `$${n.toFixed(n < 1 ? 4 : 2)}`;

export default async function AdminPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const v = await viewer();
  if (!v) return redirect({ href: "/sign-in", locale });
  if (!v.isPlatformAdmin) notFound();
  const t = await getTranslations("admin");
  const lang = locale === "en" ? "en" : "vi";
  const [ws, steps, users, plans, queues] = await Promise.all([
    adminWorkspaces(),
    adminCostByStep(),
    adminUsers(),
    adminPlans(),
    queueHealth(),
  ]);
  const totals = ws.reduce(
    (a, w) => ({ cost: a.cost + w.costUsd, usd: a.usd + w.revenueUsd, vnd: a.vnd + w.revenueVnd }),
    { cost: 0, usd: 0, vnd: 0 },
  );
  return (
    <div className="flex flex-col gap-6" data-testid="admin">
      <PageHeader title={t("title")} />

      <Card>
        <CardHeader>
          <CardTitle>{t("queues")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table data-testid="admin-queues">
            <TableHeader>
              <TableRow>
                <TableHead>{t("queue")}</TableHead>
                <TableHead>{t("workers")}</TableHead>
                <TableHead>{t("waiting")}</TableHead>
                <TableHead>{t("active")}</TableHead>
                <TableHead>{t("failed")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {queues.map((q) => (
                <TableRow key={q.name}>
                  <TableCell>{q.name}</TableCell>
                  <TableCell>{q.workers}</TableCell>
                  <TableCell>{(q.counts.waiting ?? 0) + (q.counts.prioritized ?? 0) + (q.counts.delayed ?? 0)}</TableCell>
                  <TableCell>{q.counts.active ?? 0}</TableCell>
                  <TableCell>{q.counts.failed ?? 0}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("costRevenue")}</CardTitle>
          <p className="text-sm" data-testid="admin-totals">
            {t("totals", { cost: usd(totals.cost), usd: usd(totals.usd), vnd: totals.vnd.toLocaleString("vi-VN") })}
          </p>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <Table data-testid="admin-workspaces">
            <TableHeader>
              <TableRow>
                <TableHead>{t("workspace")}</TableHead>
                <TableHead>{t("owner")}</TableHead>
                <TableHead>{t("plan")}</TableHead>
                <TableHead>{t("videos")}</TableHead>
                <TableHead>{t("aiCost")}</TableHead>
                <TableHead>{t("revenue")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ws.map((w) => (
                <TableRow key={w.id}>
                  <TableCell>
                    {w.name}
                    <br />
                    <code className="text-muted-foreground font-mono text-xs">{w.id}</code>
                  </TableCell>
                  <TableCell className="text-sm">{w.owner}</TableCell>
                  <TableCell>{w.plan}</TableCell>
                  <TableCell>{w.videos}</TableCell>
                  <TableCell>{usd(w.costUsd)}</TableCell>
                  <TableCell>
                    {usd(w.revenueUsd)}
                    {w.revenueVnd > 0 && ` + ${w.revenueVnd.toLocaleString("vi-VN")} ₫`}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div>
            <h3 className="mb-2 text-sm font-semibold">{t("byStep")}</h3>
            <Table>
              <TableBody>
                {steps.map((s) => (
                  <TableRow key={`${s.step}-${s.provider}`}>
                    <TableCell>{s.step}</TableCell>
                    <TableCell>{s.provider}</TableCell>
                    <TableCell>{s.calls}</TableCell>
                    <TableCell>{usd(Number(s.usd))}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">{t("plans")}</h2>
        <GrantPlan planIds={plans.map((p) => p.id)} />
        <AdminPlans
          plans={plans.map((p) => ({
            id: p.id,
            name: p.nameI18n[lang],
            priceUsd: Number(p.priceUsd),
            priceVnd: p.priceVnd,
            limits: p.limits as unknown as Record<string, unknown>,
            watermark: p.watermark,
            polarProductId: p.polarProductId,
            active: p.active,
          }))}
        />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>{t("users", { n: users.length })}</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="divide-y text-sm">
            {users.slice(0, 100).map((u) => (
              <li key={u.id} className="flex flex-wrap items-center gap-2 py-1.5">
                <span className="min-w-0 flex-1 truncate">{u.email}</span>
                {u.admin && <Badge variant="secondary">{t("admin")}</Badge>}
                <span className="text-muted-foreground">{u.createdAt.toLocaleDateString(locale)}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
