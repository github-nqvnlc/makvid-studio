"use client";
// API keys and webhook endpoints. Secrets are shown once, right after creation.
import { useState } from "react";
import { Copy } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/PageHeader";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Link, useRouter } from "@/i18n/navigation";
import { apiError, postJson } from "@/lib/api-client";

export interface KeyRow {
  id: string;
  name: string;
  prefix: string;
  lastUsedAt: string | null;
  createdAt: string;
}
export interface HookRow {
  id: string;
  url: string;
  events: string[];
  deliveries: Array<{ event: string; status: string; attempts: number; lastHttpStatus: number | null }>;
}

export function ApiSettings({ keys, hooks, apiEnabled }: { keys: KeyRow[]; hooks: HookRow[]; apiEnabled: boolean }) {
  const t = useTranslations("api");
  const te = useTranslations("errors");
  const router = useRouter();
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [secret, setSecret] = useState<{ label: string; value: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function createKey(e: React.FormEvent) {
    e.preventDefault();
    const r = await postJson<{ key: string }>("/api/workspace/api-keys", { name });
    if (!r.ok) return setError(te(r.error));
    setSecret({ label: t("keyOnce"), value: r.data.key });
    setName("");
    router.refresh();
  }
  async function addHook(e: React.FormEvent) {
    e.preventDefault();
    const r = await postJson<{ secret: string }>("/api/workspace/webhooks", { url });
    if (!r.ok) return setError(te(r.error));
    setSecret({ label: t("secretOnce"), value: r.data.secret });
    setUrl("");
    router.refresh();
  }
  async function remove(path: string) {
    const res = await fetch(path, { method: "DELETE" });
    if (!res.ok) return setError(te(await apiError(res)));
    router.refresh();
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <PageHeader
        title={t("title")}
        description={t("intro")}
        actions={
          <Link href="/docs/api" className="text-sm underline underline-offset-4">
            {t("docs")}
          </Link>
        }
      />
      {secret && (
        <Alert data-testid="secret-once">
          <AlertDescription className="flex flex-col gap-2">
            <span>{secret.label}</span>
            <span className="flex flex-wrap items-center gap-2">
              <code className="bg-muted rounded px-2 py-1 font-mono text-xs break-all">{secret.value}</code>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => void navigator.clipboard.writeText(secret.value).then(() => toast.success(t("copied")))}
              >
                <Copy className="size-3.5" aria-hidden />
                {t("copy")}
              </Button>
            </span>
          </AlertDescription>
        </Alert>
      )}
      <Card>
        <CardHeader>
          <CardTitle>{t("keys")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <ul className="divide-y" data-testid="api-keys">
            {keys.map((k) => (
              <li key={k.id} className="flex flex-wrap items-center gap-3 py-2">
                <strong>{k.name}</strong>
                <code className="text-muted-foreground font-mono text-xs">{k.prefix}_…</code>
                <span className="text-muted-foreground flex-1 text-sm">
                  {k.lastUsedAt ? t("lastUsed", { at: new Date(k.lastUsedAt).toLocaleString() }) : t("neverUsed")}
                </span>
                <Button variant="outline" size="sm" onClick={() => void remove(`/api/workspace/api-keys/${k.id}`)}>
                  {t("revoke")}
                </Button>
              </li>
            ))}
          </ul>
          <form className="flex flex-wrap gap-2" onSubmit={(e) => void createKey(e)}>
            <Input required maxLength={80} placeholder={t("keyName")} aria-label={t("keyName")} value={name} onChange={(e) => setName(e.target.value)} disabled={!apiEnabled} className="min-w-48 flex-1" />
            <Button type="submit" disabled={!apiEnabled}>
              {t("createKey")}
            </Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t("webhooks")}</CardTitle>
          <p className="text-muted-foreground text-sm">{t("webhooksHelp")}</p>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <ul className="divide-y">
            {hooks.map((h) => (
              <li key={h.id} className="flex flex-col gap-1 py-2">
                <span className="flex flex-wrap items-center gap-3">
                  <code className="min-w-0 flex-1 font-mono text-xs break-all">{h.url}</code>
                  <Button variant="outline" size="sm" onClick={() => void remove(`/api/workspace/webhooks/${h.id}`)}>
                    {t("remove")}
                  </Button>
                </span>
                <span className="text-muted-foreground text-xs">
                  {h.deliveries
                    .slice(-5)
                    .map((d) => `${d.event}: ${d.status}${d.lastHttpStatus ? ` (${d.lastHttpStatus})` : ""}`)
                    .join(" · ")}
                </span>
              </li>
            ))}
          </ul>
          <form className="flex flex-wrap gap-2" onSubmit={(e) => void addHook(e)}>
            <Input type="url" required placeholder="https://…" aria-label={t("webhookUrl")} value={url} onChange={(e) => setUrl(e.target.value)} disabled={!apiEnabled} className="min-w-48 flex-1" />
            <Button type="submit" disabled={!apiEnabled}>
              {t("addWebhook")}
            </Button>
          </form>
        </CardContent>
      </Card>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
