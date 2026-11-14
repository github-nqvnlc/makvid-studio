"use client";
// "Save as template": pick phrases of the finished video that become `{{variables}}`.
import { useState } from "react";
import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
      <Button variant="outline" onClick={() => setOpen(true)} data-testid="save-template">
        {t("save")}
      </Button>
    );
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("title")}</CardTitle>
        <p className="text-muted-foreground text-sm">{t("help")}</p>
      </CardHeader>
      <CardContent>
        <form className="flex flex-col gap-4" onSubmit={(e) => void save(e)} data-testid="template-form">
          <div className="flex flex-col gap-2">
            <Label htmlFor="template-name">{t("name")}</Label>
            <Input id="template-name" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} required />
          </div>
          {rows.map((r, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-2">
              <Input
                aria-label={t("find")}
                placeholder={t("find")}
                value={r.find}
                onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, find: e.target.value } : x)))}
              />
              <Input
                aria-label={t("variable")}
                placeholder={slug(r.find) || t("variable")}
                value={r.name}
                pattern="[a-z_][a-z0-9_]{0,39}"
                className="font-mono"
                onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
              />
            </div>
          ))}
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => setRows([...rows, { find: "", name: "" }])}>
              <Plus className="size-4" aria-hidden />
              {t("addRow")}
            </Button>
            <Button type="submit" size="sm">
              {t("save")}
            </Button>
          </div>
          {saved && (
            <Alert data-testid="template-saved">
              <AlertDescription>
                {t("saved", { vars: saved.vars.join(", ") })}{" "}
                <Link href={`/batches?template=${saved.id}`} className="underline underline-offset-4">
                  {t("goBatch")}
                </Link>
              </AlertDescription>
            </Alert>
          )}
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
