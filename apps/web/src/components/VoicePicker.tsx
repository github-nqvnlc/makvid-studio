"use client";
// Voice picker (T108a): voices grouped by tier with gender + region and a preview clip per voice.
import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { VoiceOption } from "@/server/catalog";

export function VoicePicker({
  voices,
  value,
  onChange,
}: {
  voices: VoiceOption[];
  value: string;
  onChange: (id: string) => void;
}) {
  const t = useTranslations("voices");
  const audio = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);

  function listen(id: string) {
    audio.current?.pause();
    const a = new Audio(`/api/voices/${encodeURIComponent(id)}/preview`);
    audio.current = a;
    setPlaying(id);
    a.onended = () => setPlaying(null);
    void a.play().catch(() => setPlaying(null));
  }

  return (
    <div className="stack" data-testid="voice-picker">
      {(["standard", "pro", "ultra"] as const).map((tier) => (
        <div key={tier} className="stack">
          <span className="muted small">{t(tier)}</span>
          <div className="choices">
            {voices
              .filter((v) => v.tier === tier)
              .map((v) => (
                <div key={v.id} className="choice" aria-pressed={value === v.id}>
                  <button
                    type="button"
                    onClick={() => onChange(v.id)}
                    style={{ all: "unset", cursor: "pointer", display: "block", width: "100%" }}
                    aria-label={v.name}
                  >
                    <strong>{v.name}</strong> {v.isDefault && <span className="badge">{t("default")}</span>}
                    <div className="muted small">
                      {t(v.gender)} · {v.region ? t(v.region) : t("other")}
                    </div>
                  </button>
                  <button
                    type="button"
                    className="btn small"
                    style={{ marginTop: 6 }}
                    onClick={() => listen(v.id)}
                  >
                    {playing === v.id ? "♪" : "▶"} {t("listen")}
                  </button>
                </div>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}
