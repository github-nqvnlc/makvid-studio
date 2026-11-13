"use client";
// Brand kit editor (T125): colours, logo and display/body fonts; uploads go to the asset library.
import { useState } from "react";
import { useTranslations } from "next-intl";
import { brandContrastIssues } from "@makvid/compiler/contrast";
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

export function BrandKitEditor({
  initial,
  assets: initialAssets,
}: {
  initial: KitValue | null;
  assets: AssetItem[];
}) {
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

  const color = (k: (typeof COLORS)[number]) => kit.colors[k] ?? DEFAULTS[k];
  const lowContrast = brandContrastIssues(Object.fromEntries(COLORS.map((k) => [k, color(k)])));
  const logo = images.find((a) => a.id === kit.logoAssetId);
  const fontLabel = (a: AssetItem) => `${a.family ?? a.name}${a.weight ? ` · ${a.weight}` : ""}`;

  return (
    <div className="editor">
      <section className="card stack">
        <h1>{t("title")}</h1>
        <p className="muted small">{t("hint")}</p>
        <label>
          {t("name")}
          <input value={kit.name} maxLength={80} onChange={(e) => setKit({ ...kit, name: e.target.value })} />
        </label>
        <h2>{t("colors")}</h2>
        <div className="choices">
          {COLORS.map((k) => (
            <label key={k} className="row" style={{ fontWeight: 400 }}>
              <input
                type="color"
                style={{ width: 48, height: 36, padding: 2 }}
                value={color(k)}
                onChange={(e) => setKit({ ...kit, colors: { ...kit.colors, [k]: e.target.value } })}
                data-testid={`color-${k}`}
              />
              {t(`color.${k}`)}
            </label>
          ))}
        </div>
        <h2>{t("logo")}</h2>
        <div className="row">
          <select
            value={kit.logoAssetId ?? ""}
            onChange={(e) => setKit({ ...kit, logoAssetId: e.target.value || null })}
            style={{ flex: "1 1 200px" }}
          >
            <option value="">{t("none")}</option>
            {images.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <select
            value={kit.logoPosition}
            onChange={(e) => setKit({ ...kit, logoPosition: e.target.value as KitValue["logoPosition"] })}
            style={{ flex: "0 1 160px" }}
          >
            <option value="top-right">{t("topRight")}</option>
            <option value="top-left">{t("topLeft")}</option>
          </select>
        </div>
        <label>
          {t("uploadLogo")}
          <input
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
        </label>
        <h2>{t("fonts")}</h2>
        {(["display", "body"] as const).map((role) => (
          <div key={role} className="stack" style={{ gap: 6 }}>
            <span className="small">{t(`font.${role}`)}</span>
            <div className="row">
              <select
                value={kit.fonts[role] ?? ""}
                onChange={(e) => setKit({ ...kit, fonts: { ...kit.fonts, [role]: e.target.value || null } })}
                style={{ flex: "1 1 200px" }}
              >
                <option value="">{t("styleFont")}</option>
                {fonts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {fontLabel(a)}
                  </option>
                ))}
              </select>
              <input
                type="file"
                accept=".ttf,.otf,.woff,.woff2"
                style={{ flex: "1 1 200px" }}
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
        {lowContrast.length > 0 && (
          <p className="error" data-testid="contrast-warning">
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
          </p>
        )}
        {msg && (
          <p className={msg.ok ? "muted" : "error"} role="alert" data-testid="brand-message">
            {msg.text}
          </p>
        )}
        <div>
          <button
            className="btn primary"
            disabled={busy || lowContrast.length > 0}
            onClick={() => void save()}
            data-testid="brand-save"
          >
            {t("save")}
          </button>
        </div>
      </section>
      <aside className="card stack" style={{ background: color("bg"), color: color("fg") }}>
        <span className="small" style={{ color: color("muted") }}>
          {t("preview")}
        </span>
        {logo?.url && (
          <img
            src={logo.url}
            alt=""
            style={{
              height: 48,
              objectFit: "contain",
              alignSelf: kit.logoPosition === "top-left" ? "flex-start" : "flex-end",
            }}
          />
        )}
        <strong style={{ fontSize: 28 }}>{t("sampleTitle")}</strong>
        <span style={{ color: color("muted") }}>{t("sampleBody")}</span>
        <span
          style={{
            alignSelf: "flex-start",
            background: color("accent"),
            color: color("accentInk"),
            padding: "6px 14px",
            borderRadius: 10,
            fontWeight: 700,
          }}
        >
          {t("sampleCta")}
        </span>
      </aside>
    </div>
  );
}
