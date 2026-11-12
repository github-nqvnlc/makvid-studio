"use client";
// Storyboard review (US3, T104): thumbnail grid, one keyframe per scene; untick scenes to drop them.
import { useState } from "react";
import { useTranslations } from "next-intl";
import type { ProjectView } from "@makvid/pipeline";
import { postJson, type ErrorKey } from "@/lib/api-client";

type Scene = NonNullable<ProjectView["review"]>["scenes"][number];

export function StoryboardReview({
  projectId,
  scenes,
  onDone,
}: {
  projectId: string;
  scenes: Scene[];
  onDone: () => void;
}) {
  const t = useTranslations();
  const [drop, setDrop] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(id: string) {
    const next = new Set(drop);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setDrop(next);
  }

  async function submit() {
    if (drop.size >= scenes.length) return setError(t("review.atLeastOne"));
    setBusy(true);
    setError(null);
    const r = await postJson(`/api/projects/${projectId}/review`, {
      point: "storyboard_review",
      edits: { dropSceneIds: [...drop] },
    });
    setBusy(false);
    if (!r.ok) return setError(t(`errors.${r.error satisfies ErrorKey}`));
    onDone();
  }

  return (
    <section className="card stack" data-testid="storyboard-review">
      <h2>{t("review.storyboardTitle")}</h2>
      <p className="muted small">{t("review.storyboardHint")}</p>
      <div className="grid-thumbs">
        {scenes.map((s, i) => (
          <figure key={s.sceneId} style={{ margin: 0, opacity: drop.has(s.sceneId) ? 0.4 : 1 }}>
            <img
              src={`/api/projects/${projectId}/previews/${s.sceneId}`}
              alt={t("editor.scene", { n: i + 1 })}
            />
            <figcaption className="small stack" style={{ gap: 4, marginTop: 6 }}>
              <strong>{t("editor.scene", { n: i + 1 })}</strong>
              <span className="muted">{s.text}</span>
              <label className="row" style={{ fontWeight: 400 }}>
                <input
                  type="checkbox"
                  style={{ width: "auto" }}
                  checked={!drop.has(s.sceneId)}
                  onChange={() => toggle(s.sceneId)}
                />
                {t("review.keep")}
              </label>
            </figcaption>
          </figure>
        ))}
      </div>
      {error && <p className="error">{error}</p>}
      <div>
        <button className="btn primary" disabled={busy} onClick={() => void submit()}>
          {t("review.makeVideo")}
        </button>
      </div>
    </section>
  );
}
