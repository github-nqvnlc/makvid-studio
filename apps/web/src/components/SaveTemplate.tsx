"use client";
// "Save as template" (US5, T130): pick phrases of the finished video that become `{{variables}}`.
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { postJson } from "@/lib/api-client";

const slug = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);

export function SaveTemplate({ projectId, title }: { projectId: string; title: string }) {
  const t = useTranslations("template");
  const te = useTranslations("errors");
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(title);
  const [rows, setRows] = useState([{ find: "", name: "" }]);
  const [saved, setSaved] = useState<{ id: string; vars: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const replacements = rows
      .filter((r) => r.find.trim())
      .map((r) => ({ find: r.find.trim(), name: r.name || slug(r.find) || "bien" }));
    const r = await postJson<{ id: string; variables: Array<{ name: string }> }>("/api/templates", {
      projectId,
      name,
      replacements,
    });
    if (!r.ok) return setError(te(r.error));
    setSaved({ id: r.data.id, vars: r.data.variables.map((v) => v.name) });
  }

  if (!open)
    return (
      <button className="btn" onClick={() => setOpen(true)} data-testid="save-template">
        {t("save")}
      </button>
    );
  return (
    <form className="card stack" onSubmit={(e) => void save(e)} data-testid="template-form">
      <h2>{t("title")}</h2>
      <p className="small muted">{t("help")}</p>
      <label className="stack">
        {t("name")}
        <input value={name} maxLength={120} onChange={(e) => setName(e.target.value)} required />
      </label>
      {rows.map((r, i) => (
        <div key={i} className="row">
          <input
            aria-label={t("find")}
            placeholder={t("find")}
            value={r.find}
            onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, find: e.target.value } : x)))}
          />
          <input
            aria-label={t("variable")}
            placeholder={slug(r.find) || t("variable")}
            value={r.name}
            pattern="[a-z_][a-z0-9_]{0,39}"
            onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
          />
        </div>
      ))}
      <div className="row">
        <button type="button" className="btn" onClick={() => setRows([...rows, { find: "", name: "" }])}>
          {t("addRow")}
        </button>
        <button className="btn primary">{t("save")}</button>
      </div>
      {saved && (
        <p data-testid="template-saved">
          {t("saved", { vars: saved.vars.join(", ") })}{" "}
          <Link href={`/batches?template=${saved.id}`}>{t("goBatch")}</Link>
        </p>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
