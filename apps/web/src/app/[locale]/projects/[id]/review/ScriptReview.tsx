"use client";
// Script review (US3, T104): edit the title and each voice-over sentence, pick one of the suggested styles
// (thumbnail + reason), then continue.
import { useState } from "react";
import { useTranslations } from "next-intl";
import type { ProjectView } from "@makvid/pipeline";
import type { StyleCard } from "@/server/catalog";
import { postJson, type ErrorKey } from "@/lib/api-client";

type Review = NonNullable<ProjectView["review"]>;

export function ScriptReview({
  projectId,
  review,
  styles,
  onDone,
}: {
  projectId: string;
  review: Review;
  styles: StyleCard[];
  onDone: () => void;
}) {
  const t = useTranslations();
  const [title, setTitle] = useState(review.title ?? "");
  const [sentences, setSentences] = useState(review.sentences);
  const [styleId, setStyle] = useState(review.styleId ?? review.styleSuggestions[0]?.styleId ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ErrorKey | null>(null);
  const byId = new Map(styles.map((s) => [s.id, s]));

  async function submit() {
    setBusy(true);
    setError(null);
    const r = await postJson(`/api/projects/${projectId}/review`, {
      point: "script_review",
      edits: { title, sentences, styleId },
    });
    setBusy(false);
    if (!r.ok) return setError(r.error);
    onDone();
  }

  return (
    <section className="card stack" data-testid="script-review">
      <h2>{t("review.scriptTitle")}</h2>
      <p className="muted small">{t("review.scriptHint")}</p>
      <label>
        {t("review.videoTitle")}
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
      </label>
      {sentences.map((s, i) => (
        <label key={i}>
          {t("review.sentence", { n: i + 1 })}
          <textarea
            value={s}
            maxLength={400}
            style={{ minHeight: 56 }}
            onChange={(e) => setSentences(sentences.map((x, j) => (j === i ? e.target.value : x)))}
          />
        </label>
      ))}
      <h2>{t("review.styles")}</h2>
      <div className="choices">
        {review.styleSuggestions.map((s) => (
          <button
            key={s.styleId}
            type="button"
            className="choice style-card"
            aria-pressed={styleId === s.styleId}
            onClick={() => setStyle(s.styleId)}
            data-testid={`style-${s.styleId}`}
          >
            <img src={`/api/styles/${s.styleId}/thumbnail`} alt="" />
            <strong>{byId.get(s.styleId)?.name ?? s.styleId}</strong>
            <div className="muted small">{s.reason}</div>
            {styleId === s.styleId && <span className="badge ok">{t("review.chosen")}</span>}
          </button>
        ))}
      </div>
      {error && <p className="error">{t(`errors.${error}`)}</p>}
      <div>
        <button className="btn primary" disabled={busy} onClick={() => void submit()}>
          {t("review.continue")}
        </button>
      </div>
    </section>
  );
}
