"use client";
// Create-project page (T102, T117): source (idea, written script, article link, GitHub repo, data file,
// audio/video), aspect, duration, mode, voice.
import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import type { VoiceOption } from "@/server/catalog";
import { apiError } from "@/lib/api-client";
import { VoicePicker } from "./VoicePicker";

const ASPECTS = ["9:16", "16:9", "1:1", "4:5"] as const;
const SOURCES = ["prompt", "script", "url", "github", "table", "media"] as const;
type SourceKind = (typeof SOURCES)[number];

export function CreateForm({ voices }: { voices: VoiceOption[] }) {
  const t = useTranslations("create");
  const te = useTranslations("errors");
  const router = useRouter();
  const ts = useTranslations("source");
  const [kind, setKind] = useState<SourceKind>("prompt");
  const [prompt, setPrompt] = useState("");
  const [script, setScript] = useState("");
  const [link, setLink] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [useSourceAudio, setUseSourceAudio] = useState(true);
  const [aspect, setAspect] = useState<(typeof ASPECTS)[number]>("9:16");
  const [durationSec, setDuration] = useState(45);
  const [mode, setMode] = useState<"auto" | "review">("auto");
  const [voiceId, setVoice] = useState(voices.find((v) => v.isDefault)?.id ?? voices[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (kind === "prompt" && prompt.trim().length < 3) return setError(t("tooShort"));
    if (kind === "script" && script.trim().length < 10) return setError(ts("scriptTooShort"));
    if ((kind === "url" || kind === "github") && !link.trim()) return setError(ts("linkMissing"));
    if ((kind === "table" || kind === "media") && !file) return setError(ts("fileMissing"));
    setBusy(true);
    setError(null);
    let res: Response;
    if (kind === "prompt")
      res = await fetch("/api/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt, aspect, durationSec, mode, voiceId }),
      });
    else {
      const fd = new FormData();
      for (const [k, v] of Object.entries({ kind, aspect, durationSec: String(durationSec), mode, voiceId }))
        fd.set(k, v);
      if (kind === "script") fd.set("text", script);
      if (kind === "url" || kind === "github") fd.set("url", link.trim());
      if (kind === "media") fd.set("useSourceAudio", String(useSourceAudio));
      if (file && (kind === "table" || kind === "media")) fd.set("file", file);
      res = await fetch("/api/projects", { method: "POST", body: fd });
    }
    if (!res.ok) {
      setBusy(false);
      return setError(te(await apiError(res)));
    }
    const { id } = (await res.json()) as { id: string };
    router.push(`/projects/${id}`);
  }

  return (
    <form onSubmit={submit} className="card stack">
      <h1>{t("title")}</h1>
      <fieldset className="stack" style={{ border: 0, padding: 0, margin: 0 }}>
        <legend style={{ fontWeight: 600, marginBottom: 6 }}>{ts("title")}</legend>
        <div className="choices">
          {SOURCES.map((k) => (
            <button
              key={k}
              type="button"
              className="choice"
              aria-pressed={kind === k}
              onClick={() => {
                setKind(k);
                setFile(null);
              }}
              data-testid={`source-${k}`}
            >
              <strong>{ts(`${k}.name`)}</strong>
              <div className="muted small">{ts(`${k}.hint`)}</div>
            </button>
          ))}
        </div>
      </fieldset>
      {kind === "prompt" && (
        <label>
          {t("idea")}
          <textarea
            name="prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={t("ideaPlaceholder")}
            maxLength={4000}
          />
        </label>
      )}
      {kind === "script" && (
        <label>
          {ts("script.label")}
          <textarea
            name="script"
            value={script}
            onChange={(e) => setScript(e.target.value)}
            placeholder={ts("script.placeholder")}
            maxLength={12000}
            style={{ minHeight: 180 }}
          />
        </label>
      )}
      {(kind === "url" || kind === "github") && (
        <label>
          {ts(`${kind}.label`)}
          <input
            name="link"
            type="url"
            inputMode="url"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder={ts(`${kind}.placeholder`)}
          />
        </label>
      )}
      {(kind === "table" || kind === "media") && (
        <label>
          {ts(`${kind}.label`)}
          <input
            name="file"
            type="file"
            accept={kind === "table" ? ".csv,.json,text/csv,application/json" : "audio/*,video/*"}
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </label>
      )}
      {kind === "media" && (
        <label className="row" style={{ fontWeight: 400 }}>
          <input
            type="checkbox"
            style={{ width: "auto" }}
            checked={useSourceAudio}
            onChange={(e) => setUseSourceAudio(e.target.checked)}
          />
          {ts("media.useSourceAudio")}
        </label>
      )}
      <div className="row" style={{ alignItems: "end" }}>
        <label style={{ flex: "1 1 220px" }}>
          {t("aspect")}
          <select name="aspect" value={aspect} onChange={(e) => setAspect(e.target.value as typeof aspect)}>
            {ASPECTS.map((a) => (
              <option key={a} value={a}>
                {t(`aspects.${a}`)}
              </option>
            ))}
          </select>
        </label>
        <label style={{ flex: "0 1 160px" }}>
          {t("duration")}
          <input
            name="duration"
            type="number"
            min={30}
            max={180}
            step={5}
            value={durationSec}
            onChange={(e) => setDuration(Number(e.target.value))}
          />
        </label>
      </div>
      <fieldset className="stack" style={{ border: 0, padding: 0, margin: 0 }}>
        <legend style={{ fontWeight: 600, marginBottom: 6 }}>{t("mode")}</legend>
        <div className="choices">
          {(["auto", "review"] as const).map((m) => (
            <button
              key={m}
              type="button"
              className="choice"
              aria-pressed={mode === m}
              onClick={() => setMode(m)}
              data-testid={`mode-${m}`}
            >
              <strong>{t(m)}</strong>
              <div className="muted small">{t(m === "auto" ? "autoHint" : "reviewHint")}</div>
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset className="stack" style={{ border: 0, padding: 0, margin: 0 }}>
        <legend style={{ fontWeight: 600, marginBottom: 6 }}>{t("voice")}</legend>
        <VoicePicker voices={voices} value={voiceId} onChange={setVoice} />
      </fieldset>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div>
        <button className="btn primary" type="submit" disabled={busy}>
          {busy ? t("submitting") : t("submit")}
        </button>
      </div>
    </form>
  );
}
