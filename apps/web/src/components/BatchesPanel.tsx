"use client";
// Batch creation: pick a template, upload a CSV, see problems before running, then start.
import { useState } from "react";
import { Layers, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { EmptyState } from "@/components/common/EmptyState";
import { NativeSelect } from "@/components/common/NativeSelect";
import { PageHeader } from "@/components/common/PageHeader";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link, useRouter } from "@/i18n/navigation";
import { apiError, type ErrorKey } from "@/lib/api-client";

export interface TemplateItem {
  id: string;
  name: string;
  variables: Array<{ name: string; maxLength: number }>;
}
export interface BatchItem {
  id: string;
  name: string;
  status: string;
  total: number;
  succeeded: number;
  failed: number;
  createdAt: string;
}
interface Check {
  rows: number;
  missingColumns: string[];
  extraColumns: string[];
  issues: Array<{
    row: number;
    column: string;
    code: "required" | "too_long" | "not_a_number";
    maxLength?: number;
  }>;
  tooManyRows: boolean;
  preview: Array<Record<string, string>>;
}

export function BatchesPanel({
  templates,
  batches,
  maxConcurrency,
  initialTemplate,
}: {
  templates: TemplateItem[];
  batches: BatchItem[];
  maxConcurrency: number;
  initialTemplate?: string;
}) {
  const t = useTranslations("batches");
  const te = useTranslations("errors");
  const tq = useTranslations("quota");
  const router = useRouter();
  const [templateId, setTemplateId] = useState(initialTemplate ?? templates[0]?.id ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [concurrency, setConcurrency] = useState(Math.min(2, maxConcurrency));
  const [check, setCheck] = useState<Check | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const tpl = templates.find((x) => x.id === templateId);

  const form = () => {
    const f = new FormData();
    f.set("templateId", templateId);
    if (file) f.set("file", file);
    f.set("name", name);
    f.set("concurrency", String(concurrency));
    return f;
  };
  const fail = async (res: Response) => {
    const body = (await res
      .clone()
      .json()
      .catch(() => null)) as { reason?: string } | null;
    const code: ErrorKey = await apiError(res);
    setError(code === "quota_exceeded" && body?.reason ? tq(body.reason as "videos") : te(code));
  };

  async function runCheck() {
    if (!file || !templateId) return;
    setBusy(true);
    setError(null);
    const res = await fetch("/api/batches/check", { method: "POST", body: form() });
    setBusy(false);
    if (!res.ok) return fail(res);
    setCheck((await res.json()) as Check);
  }

  async function start() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/batches", { method: "POST", body: form() });
    setBusy(false);
    if (res.status === 400) {
      const b = (await res.json()) as Partial<Check>;
      if (b.issues || b.missingColumns) return setCheck((c) => ({ ...(c as Check), ...b }));
    }
    if (!res.ok) return fail(res);
    const { id } = (await res.json()) as { id: string };
    router.push(`/batches/${id}`);
  }

  const valid = check && !check.missingColumns.length && !check.issues.length && !check.tooManyRows && check.rows > 0;
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <PageHeader title={t("title")} description={t("intro")} />
      <Card data-testid="batch-form">
        <CardHeader>
          <CardTitle>{t("new")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {!templates.length ? (
            <EmptyState icon={Layers} title={t("noTemplates")} />
          ) : (
            <>
              <div className="flex flex-col gap-2">
                <Label htmlFor="batch-template">{t("template")}</Label>
                <NativeSelect
                  id="batch-template"
                  value={templateId}
                  onChange={(e) => {
                    setTemplateId(e.target.value);
                    setCheck(null);
                  }}
                >
                  {templates.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                    </option>
                  ))}
                </NativeSelect>
                {tpl && (
                  <p className="text-muted-foreground text-sm">{t("variables", { vars: tpl.variables.map((v) => v.name).join(", ") })}</p>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="batch-file">{t("file")}</Label>
                <Input
                  id="batch-file"
                  type="file"
                  accept=".csv,text/csv"
                  data-testid="batch-file"
                  onChange={(e) => {
                    setFile(e.target.files?.[0] ?? null);
                    setCheck(null);
                  }}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="batch-name">{t("name")}</Label>
                  <Input id="batch-name" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="batch-concurrency">{t("concurrency")}</Label>
                  <Input
                    id="batch-concurrency"
                    type="number"
                    min={1}
                    max={maxConcurrency}
                    value={concurrency}
                    onChange={(e) => setConcurrency(Math.max(1, Math.min(maxConcurrency, Number(e.target.value) || 1)))}
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" disabled={!file || busy} onClick={() => void runCheck()}>
                  {busy && <Loader2 className="size-4 motion-safe:animate-spin" aria-hidden />}
                  {t("check")}
                </Button>
                {valid && (
                  <Button disabled={busy} onClick={() => void start()} data-testid="batch-start">
                    {t("start", { n: check.rows })}
                  </Button>
                )}
              </div>
              {check && (
                <div className="flex flex-col gap-2 text-sm" data-testid="batch-check">
                  {check.missingColumns.length > 0 && (
                    <Alert variant="destructive">
                      <AlertDescription>{t("missing", { cols: check.missingColumns.join(", ") })}</AlertDescription>
                    </Alert>
                  )}
                  {check.tooManyRows && (
                    <Alert variant="destructive">
                      <AlertDescription>{t("tooMany")}</AlertDescription>
                    </Alert>
                  )}
                  {check.issues.slice(0, 20).map((i) => (
                    <p key={`${i.row}-${i.column}`} className="text-destructive">
                      {t(`issue_${i.code}`, { row: i.row, column: i.column, max: i.maxLength ?? 0 })}
                    </p>
                  ))}
                  {valid && <p>{t("rowsOk", { n: check.rows })}</p>}
                  {check.extraColumns.length > 0 && <p className="text-muted-foreground">{t("extra", { cols: check.extraColumns.join(", ") })}</p>}
                </div>
              )}
            </>
          )}
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("list")}</CardTitle>
        </CardHeader>
        <CardContent>
          {!batches.length ? (
            <p className="text-muted-foreground text-sm">{t("empty")}</p>
          ) : (
            <ul className="divide-y">
              {batches.map((b) => (
                <li key={b.id} className="flex flex-wrap items-center gap-3 py-2">
                  <Link href={`/batches/${b.id}`} className="min-w-0 flex-1 truncate font-medium hover:underline">
                    {b.name}
                  </Link>
                  <Badge variant="secondary">{t(`status.${b.status}` as "status.running")}</Badge>
                  <span className="text-muted-foreground text-sm">{t("progress", { done: b.succeeded, total: b.total })}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
