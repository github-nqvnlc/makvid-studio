// Platform admin area (US9, T149): only users flagged is_platform_admin (set by an operator in SQL).
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { adminCostByStep, adminPlans, adminUsers, adminWorkspaces, queueHealth } from "@/server/admin";
import { viewer } from "@/server/session";
import { AdminPlans, GrantPlan } from "@/components/AdminPlans";

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
    <div className="stack" data-testid="admin">
      <h1>{t("title")}</h1>

      <section className="card stack">
        <h2>{t("queues")}</h2>
        <table data-testid="admin-queues">
          <thead>
            <tr>
              <th>{t("queue")}</th>
              <th>{t("workers")}</th>
              <th>{t("waiting")}</th>
              <th>{t("active")}</th>
              <th>{t("failed")}</th>
            </tr>
          </thead>
          <tbody>
            {queues.map((q) => (
              <tr key={q.name}>
                <td>{q.name}</td>
                <td>{q.workers}</td>
                <td>{(q.counts.waiting ?? 0) + (q.counts.prioritized ?? 0) + (q.counts.delayed ?? 0)}</td>
                <td>{q.counts.active ?? 0}</td>
                <td>{q.counts.failed ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card stack">
        <h2>{t("costRevenue")}</h2>
        <p className="small" data-testid="admin-totals">
          {t("totals", {
            cost: usd(totals.cost),
            usd: usd(totals.usd),
            vnd: totals.vnd.toLocaleString("vi-VN"),
          })}
        </p>
        <table data-testid="admin-workspaces">
          <thead>
            <tr>
              <th>{t("workspace")}</th>
              <th>{t("owner")}</th>
              <th>{t("plan")}</th>
              <th>{t("videos")}</th>
              <th>{t("aiCost")}</th>
              <th>{t("revenue")}</th>
            </tr>
          </thead>
          <tbody>
            {ws.map((w) => (
              <tr key={w.id}>
                <td>
                  {w.name}
                  <br />
                  <code className="small">{w.id}</code>
                </td>
                <td className="small">{w.owner}</td>
                <td>{w.plan}</td>
                <td>{w.videos}</td>
                <td>{usd(w.costUsd)}</td>
                <td>
                  {usd(w.revenueUsd)}
                  {w.revenueVnd > 0 && ` + ${w.revenueVnd.toLocaleString("vi-VN")} ₫`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <h3>{t("byStep")}</h3>
        <table>
          <tbody>
            {steps.map((s) => (
              <tr key={`${s.step}-${s.provider}`}>
                <td>{s.step}</td>
                <td>{s.provider}</td>
                <td>{s.calls}</td>
                <td>{usd(Number(s.usd))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="stack">
        <h2>{t("plans")}</h2>
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

      <section className="card stack">
        <h2>{t("users", { n: users.length })}</h2>
        <ul className="list small">
          {users.slice(0, 100).map((u) => (
            <li key={u.id}>
              {u.email} {u.admin && <span className="badge">admin</span>} ·{" "}
              {u.createdAt.toLocaleDateString(locale)}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
