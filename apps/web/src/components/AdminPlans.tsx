"use client";
// Plan editor and manual plan grants for platform admins (US9). Limits are edited as JSON (few admins).
import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { apiError, postJson } from "@/lib/api-client";

export interface AdminPlan {
  id: string;
  name: string;
  priceUsd: number;
  priceVnd: number;
  limits: Record<string, unknown>;
  watermark: boolean;
  polarProductId: string | null;
  active: boolean;
}

function PlanForm({ plan }: { plan: AdminPlan }) {
  const t = useTranslations("admin");
  const te = useTranslations("errors");
  const router = useRouter();
  const [usd, setUsd] = useState(String(plan.priceUsd));
  const [vnd, setVnd] = useState(String(plan.priceVnd));
  const [limits, setLimits] = useState(JSON.stringify(plan.limits, null, 2));
  const [polar, setPolar] = useState(plan.polarProductId ?? "");
  const [watermark, setWatermark] = useState(plan.watermark);
  const [active, setActive] = useState(plan.active);
  const [msg, setMsg] = useState<string | null>(null);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    let parsed: unknown;
    try {
      parsed = JSON.parse(limits);
    } catch {
      return setMsg(te("invalid"));
    }
    const res = await fetch(`/api/admin/plans/${plan.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        priceUsd: Number(usd),
        priceVnd: Number(vnd),
        limits: parsed,
        watermark,
        polarProductId: polar.trim() || null,
        active,
      }),
    });
    setMsg(res.ok ? t("saved") : te(await apiError(res)));
    router.refresh();
  }
  return (
    <form className="card stack" onSubmit={(e) => void save(e)} data-testid={`admin-plan-${plan.id}`}>
      <h3>
        {plan.name} <code className="small">{plan.id}</code>
      </h3>
      <div className="row">
        <label>
          USD <input value={usd} onChange={(e) => setUsd(e.target.value)} size={6} />
        </label>
        <label>
          VND <input value={vnd} onChange={(e) => setVnd(e.target.value)} size={10} />
        </label>
        <label>
          Polar product <input value={polar} onChange={(e) => setPolar(e.target.value)} size={36} />
        </label>
      </div>
      <div className="row">
        <label>
          <input type="checkbox" checked={watermark} onChange={(e) => setWatermark(e.target.checked)} />{" "}
          watermark
        </label>
        <label>
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />{" "}
          {t("active")}
        </label>
      </div>
      <textarea rows={8} value={limits} onChange={(e) => setLimits(e.target.value)} spellCheck={false} />
      <div className="row">
        <button className="btn primary">{t("save")}</button>
        {msg && <span className="small">{msg}</span>}
      </div>
    </form>
  );
}

export function AdminPlans({ plans }: { plans: AdminPlan[] }) {
  return (
    <div className="stack">
      {plans.map((p) => (
        <PlanForm key={p.id} plan={p} />
      ))}
    </div>
  );
}

export function GrantPlan({ planIds }: { planIds: string[] }) {
  const t = useTranslations("admin");
  const te = useTranslations("errors");
  const router = useRouter();
  const [ws, setWs] = useState("");
  const [plan, setPlan] = useState(planIds[1] ?? planIds[0] ?? "");
  const [days, setDays] = useState("30");
  const [msg, setMsg] = useState<string | null>(null);
  async function grant(e: React.FormEvent) {
    e.preventDefault();
    const r = await postJson("/api/admin/grant", {
      workspaceId: ws.trim(),
      planId: plan,
      days: Number(days),
    });
    setMsg(r.ok ? t("granted") : te(r.error));
    router.refresh();
  }
  return (
    <form className="card row" onSubmit={(e) => void grant(e)}>
      <input
        placeholder="workspace id"
        value={ws}
        onChange={(e) => setWs(e.target.value)}
        size={38}
        required
      />
      <select value={plan} onChange={(e) => setPlan(e.target.value)}>
        {planIds.map((p) => (
          <option key={p}>{p}</option>
        ))}
      </select>
      <input type="number" min={1} value={days} onChange={(e) => setDays(e.target.value)} />
      <button className="btn">{t("grant")}</button>
      {msg && <span className="small">{msg}</span>}
    </form>
  );
}
