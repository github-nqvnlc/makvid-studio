"use client";
// Plan editor and manual plan grants for platform admins. Limits are edited as JSON (few admins).
import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { NativeSelect } from "@/components/common/NativeSelect";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  async function save(e: React.FormEvent) {
    e.preventDefault();
    let parsed: unknown;
    try {
      parsed = JSON.parse(limits);
    } catch {
      return toast.error(te("invalid"));
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
    if (res.ok) toast.success(t("saved"));
    else toast.error(te(await apiError(res)));
    router.refresh();
  }
  return (
    <Card data-testid={`admin-plan-${plan.id}`}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {plan.name} <code className="text-muted-foreground font-mono text-xs">{plan.id}</code>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form className="flex flex-col gap-4" onSubmit={(e) => void save(e)}>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`usd-${plan.id}`}>{"USD"}</Label>
              <Input id={`usd-${plan.id}`} value={usd} onChange={(e) => setUsd(e.target.value)} inputMode="decimal" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`vnd-${plan.id}`}>{"VND"}</Label>
              <Input id={`vnd-${plan.id}`} value={vnd} onChange={(e) => setVnd(e.target.value)} inputMode="numeric" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`polar-${plan.id}`}>{t("polarProduct")}</Label>
              <Input id={`polar-${plan.id}`} value={polar} onChange={(e) => setPolar(e.target.value)} className="font-mono" />
            </div>
          </div>
          <div className="flex flex-wrap gap-6">
            <Label className="font-normal">
              <Checkbox checked={watermark} onCheckedChange={(v) => setWatermark(v === true)} />
              {t("watermark")}
            </Label>
            <Label className="font-normal">
              <Checkbox checked={active} onCheckedChange={(v) => setActive(v === true)} />
              {t("active")}
            </Label>
          </div>
          <Textarea rows={8} value={limits} onChange={(e) => setLimits(e.target.value)} spellCheck={false} className="font-mono text-xs" aria-label={t("limits")} />
          <Button type="submit" className="w-fit">
            {t("save")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export function AdminPlans({ plans }: { plans: AdminPlan[] }) {
  return (
    <div className="flex flex-col gap-4">
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
  async function grant(e: React.FormEvent) {
    e.preventDefault();
    const r = await postJson("/api/admin/grant", { workspaceId: ws.trim(), planId: plan, days: Number(days) });
    if (r.ok) toast.success(t("granted"));
    else toast.error(te(r.error));
    router.refresh();
  }
  return (
    <Card>
      <CardContent>
        <form className="flex flex-wrap items-center gap-2" onSubmit={(e) => void grant(e)}>
          <Input placeholder={t("workspaceId")} aria-label={t("workspaceId")} value={ws} onChange={(e) => setWs(e.target.value)} required className="min-w-72 flex-1 font-mono" />
          <NativeSelect value={plan} onChange={(e) => setPlan(e.target.value)} aria-label={t("plan")}>
            {planIds.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </NativeSelect>
          <Input type="number" min={1} value={days} onChange={(e) => setDays(e.target.value)} aria-label={t("days")} className="w-24" />
          <Button type="submit" variant="outline">
            {t("grant")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
