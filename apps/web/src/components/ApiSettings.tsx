"use client";
// API keys and webhook endpoints (US7). Secrets are shown once, right after creation.
import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
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

export function ApiSettings({
  keys,
  hooks,
  apiEnabled,
}: {
  keys: KeyRow[];
  hooks: HookRow[];
  apiEnabled: boolean;
}) {
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
    <div className="stack">
      <h1>{t("title")}</h1>
      <p className="small">
        {t("intro")} <a href="../docs/api">{t("docs")}</a>
      </p>
      {!apiEnabled && <p className="badge">{t("planNeeded")}</p>}
      {secret && (
        <div className="card stack" data-testid="secret-once">
          <p className="small">{secret.label}</p>
          <code>{secret.value}</code>
        </div>
      )}
      <section className="card stack">
        <h2>{t("keys")}</h2>
        <ul className="list" data-testid="api-keys">
          {keys.map((k) => (
            <li key={k.id} className="row">
              <strong>{k.name}</strong>
              <code className="small">{k.prefix}_…</code>
              <span className="small muted">
                {k.lastUsedAt
                  ? t("lastUsed", { at: new Date(k.lastUsedAt).toLocaleString() })
                  : t("neverUsed")}
              </span>
              <button className="btn" onClick={() => void remove(`/api/workspace/api-keys/${k.id}`)}>
                {t("revoke")}
              </button>
            </li>
          ))}
        </ul>
        <form className="row" onSubmit={(e) => void createKey(e)}>
          <input
            required
            maxLength={80}
            placeholder={t("keyName")}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button className="btn primary">{t("createKey")}</button>
        </form>
      </section>
      <section className="card stack">
        <h2>{t("webhooks")}</h2>
        <p className="small muted">{t("webhooksHelp")}</p>
        <ul className="list">
          {hooks.map((h) => (
            <li key={h.id} className="stack">
              <span className="row">
                <code className="small">{h.url}</code>
                <button className="btn" onClick={() => void remove(`/api/workspace/webhooks/${h.id}`)}>
                  {t("remove")}
                </button>
              </span>
              <span className="small muted">
                {h.deliveries
                  .slice(-5)
                  .map((d) => `${d.event}: ${d.status}${d.lastHttpStatus ? ` (${d.lastHttpStatus})` : ""}`)
                  .join(" · ")}
              </span>
            </li>
          ))}
        </ul>
        <form className="row" onSubmit={(e) => void addHook(e)}>
          <input
            type="url"
            required
            placeholder="https://…"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <button className="btn primary">{t("addWebhook")}</button>
        </form>
      </section>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
