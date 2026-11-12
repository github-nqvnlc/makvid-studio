"use client";
// Create-project page (T102): idea, aspect, duration, mode, voice.
import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import type { VoiceOption } from "@/server/catalog";
import { apiError } from "@/lib/api-client";
import { VoicePicker } from "./VoicePicker";

const ASPECTS = ["9:16", "16:9", "1:1", "4:5"] as const;

export function CreateForm({ voices }: { voices: VoiceOption[] }) {
  const t = useTranslations("create");
  const te = useTranslations("errors");
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [aspect, setAspect] = useState<(typeof ASPECTS)[number]>("9:16");
  const [durationSec, setDuration] = useState(45);
  const [mode, setMode] = useState<"auto" | "review">("auto");
  const [voiceId, setVoice] = useState(voices.find((v) => v.isDefault)?.id ?? voices[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (prompt.trim().length < 3) return setError(t("tooShort"));
    setBusy(true);
    setError(null);
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ prompt, aspect, durationSec, mode, voiceId }),
    });
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
