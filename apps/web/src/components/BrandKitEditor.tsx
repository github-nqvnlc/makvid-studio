"use client";
// Brand kit editor: colours, logo and display/body fonts; uploads go to the asset library.
import { useState } from "react";
import { useTranslations } from "next-intl";
import { brandContrastIssues } from "@makvid/compiler/contrast";
import { ColorField } from "@/components/common/ColorField";
import { NativeSelect } from "@/components/common/NativeSelect";
import { PageHeader } from "@/components/common/PageHeader";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiError, type ErrorKey } from "@/lib/api-client";

export interface AssetItem {
  id: string;
  kind: string;
  name: string;
  url: string | null;
  family?: string;
  weight?: number;
}
export interface KitValue {
  name: string;
  colors: Record<string, string>;
  logoAssetId: string | null;
  logoPosition: "top-left" | "top-right";
  fonts: { display?: string | null; body?: string | null };
}

const COLORS = ["bg", "fg", "accent", "accentInk", "surface", "muted"] as const;
const DEFAULTS: Record<(typeof COLORS)[number], string> = {
  bg: "#ffffff",
  fg: "#111111",
  accent: "#2f5bea",
  accentInk: "#ffffff",
  surface: "#f4f4f4",
  muted: "#666666",
};

export function BrandKitEditor({ initial, assets: initialAssets }: { initial: KitValue | null; assets: AssetItem[] }) {
  const t = useTranslations("brand");
  const te = useTranslations("errors");
  const [kit, setKit] = useState<KitValue>(
    initial ?? { name: "", colors: {}, logoAssetId: null, logoPosition: "top-right", fonts: {} },
  );
  const [assets, setAssets] = useState(initialAssets);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const images = assets.filter((a) => a.kind === "image");
  const fonts = assets.filter((a) => a.kind === "font");

  async function upload(file: File, kind: "image" | "font"): Promise<string | null> {
    const fd = new FormData();
    fd.set("file", file);
    fd.set("kind", kind);
    const res = await fetch("/api/assets", { method: "POST", body: fd });
    if (!res.ok) {
      setMsg({ ok: false, text: te(await apiError(res)) });
      return null;
    }
    const { id } = (await res.json()) as { id: string };
    const list = await fetch("/api/assets").then((r) => r.json() as Promise<{ assets: AssetItem[] }>);
    setAssets(list.assets);
    return id;
  }

  const color = (k: (typeof COLORS)[number]) => kit.colors[k] ?? DEFAULTS[k];

  async function save() {
    setBusy(true);
    setMsg(null);
    // Always the full palette shown on screen: a partial one would mix with the style's colours.
    const colors = Object.fromEntries(COLORS.map((k) => [k, color(k)]));
    const res = await fetch("/api/brand", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...kit, colors }),
    });
    setBusy(false);
    if (!res.ok) return setMsg({ ok: false, text: te((await apiError(res)) satisfies ErrorKey) });
    setMsg({ ok: true, text: t("saved") });
  }

  const lowContrast = brandContrastIssues(Object.fromEntries(COLORS.map((k) => [k, color(k)])));
  const logo = images.find((a) => a.id === kit.logoAssetId);
  const fontLabel = (a: AssetItem) => `${a.family ?? a.name}${a.weight ? ` · ${a.weight}` : ""}`;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <PageHeader title={t("title")} description={t("hint")} />
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="flex min-w-0 flex-col gap-6">
          <Card>
            <CardContent className="flex flex-col gap-2">
              <Label htmlFor="brand-name">{t("name")}</Label>
              <Input id="brand-name" value={kit.name} maxLength={80} onChange={(e) => setKit({ ...kit, name: e.target.value })} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("colors")}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              {COLORS.map((k) => (
                <div key={k} className="flex flex-col gap-1.5">
                  <Label>{t(`color.${k}`)}</Label>
                  <ColorField
                    label={t(`color.${k}`)}
                    value={color(k)}
                    testId={`color-${k}`}
                    onChange={(v) => setKit((p) => ({ ...p, colors: { ...p.colors, [k]: v } }))}
                  />
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("logo")}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="flex flex-wrap gap-2">
                <NativeSelect
                  value={kit.logoAssetId ?? ""}
                  onChange={(e) => setKit({ ...kit, logoAssetId: e.target.value || null })}
                  aria-label={t("logo")}
                  className="min-w-48 flex-1"
                >
                  <option value="">{t("none")}</option>
                  {images.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </NativeSelect>
                <NativeSelect
                  value={kit.logoPosition}
                  onChange={(e) => setKit({ ...kit, logoPosition: e.target.value as KitValue["logoPosition"] })}
                  aria-label={t("logoPosition")}
                >
                  <option value="top-right">{t("topRight")}</option>
                  <option value="top-left">{t("topLeft")}</option>
                </NativeSelect>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="upload-logo">{t("uploadLogo")}</Label>
                <Input
                  id="upload-logo"
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  data-testid="upload-logo"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    const id = await upload(f, "image");
                    if (id) setKit((k) => ({ ...k, logoAssetId: id }));
                  }}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("fonts")}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              {(["display", "body"] as const).map((role) => (
                <div key={role} className="flex flex-col gap-2">
                  <Label>{t(`font.${role}`)}</Label>
                  <div className="flex flex-wrap gap-2">
                    <NativeSelect
                      value={kit.fonts[role] ?? ""}
                      onChange={(e) => setKit({ ...kit, fonts: { ...kit.fonts, [role]: e.target.value || null } })}
                      aria-label={t(`font.${role}`)}
                      className="min-w-48 flex-1"
                    >
                      <option value="">{t("styleFont")}</option>
                      {fonts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {fontLabel(a)}
                        </option>
                      ))}
                    </NativeSelect>
                    <Input
                      type="file"
                      accept=".ttf,.otf,.woff,.woff2"
                      className="min-w-48 flex-1"
                      aria-label={t("uploadFont")}
                      data-testid={`upload-font-${role}`}
                      onChange={async (e) => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        const id = await upload(f, "font");
                        if (id) setKit((k) => ({ ...k, fonts: { ...k.fonts, [role]: id } }));
                      }}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {lowContrast.length > 0 && (
            <Alert variant="destructive" data-testid="contrast-warning">
              <AlertDescription>
                {t("contrast", {
                  pairs: lowContrast
                    .map((p) =>
                      p
                        .split("/")
                        .map((k) => t(`color.${k}`))
                        .join(" / "),
                    )
                    .join(", "),
                })}
              </AlertDescription>
            </Alert>
          )}
          {msg && (
            <Alert variant={msg.ok ? "default" : "destructive"} data-testid="brand-message">
              <AlertDescription>{msg.text}</AlertDescription>
            </Alert>
          )}
          <Button className="w-fit" disabled={busy || lowContrast.length > 0} onClick={() => void save()} data-testid="brand-save">
            {t("save")}
          </Button>
        </div>

        {/* The preview paints the colors being edited, so these values are data, not theme tokens. */}
        <aside
          className="flex flex-col gap-3 self-start rounded-xl border p-5 lg:sticky lg:top-20"
          style={{ background: color("bg"), color: color("fg") }}
          aria-label={t("preview")}
        >
          <span className="text-xs" style={{ color: color("muted") }}>
            {t("preview")}
          </span>
          {logo?.url && (
            <img
              src={logo.url}
              alt=""
              className="h-12 object-contain"
              style={{ alignSelf: kit.logoPosition === "top-left" ? "flex-start" : "flex-end" }}
            />
          )}
          <strong className="text-3xl">{t("sampleTitle")}</strong>
          <span style={{ color: color("muted") }}>{t("sampleBody")}</span>
          <span className="w-fit rounded-md px-4 py-1.5 font-bold" style={{ background: color("accent"), color: color("accentInk") }}>
            {t("sampleCta")}
          </span>
        </aside>
      </div>
    </div>
  );
}
