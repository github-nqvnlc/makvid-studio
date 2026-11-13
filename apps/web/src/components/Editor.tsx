"use client";
// Project editor (T103): preview with audio + seek, scene strip, chat panel, versions, downloads; review
// screens while the project waits for the user (US3). Live progress comes from the SSE endpoint.
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { ProjectView } from "@makvid/pipeline";
import type { StyleCard } from "@/server/catalog";
import { useRouter } from "@/i18n/navigation";
import { apiError, postJson, type ErrorKey } from "@/lib/api-client";
import { Downloads } from "./Downloads";
import { SaveTemplate } from "./SaveTemplate";
import { VersionHistory } from "./VersionHistory";
import { ScriptReview } from "@/app/[locale]/projects/[id]/review/ScriptReview";
import { StoryboardReview } from "@/app/[locale]/projects/[id]/review/StoryboardReview";

type View = ProjectView;
interface Live {
  status: string;
  text: string | null;
  fraction: number;
  headVersionId: string | null;
}
const SETTLED = new Set(["ready", "needs_attention", "failed"]);

export function Editor({ projectId, styles }: { projectId: string; styles: StyleCard[] }) {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const [view, setView] = useState<View | null>(null);
  const [live, setLive] = useState<Live | null>(null);
  const [loadError, setLoadError] = useState<ErrorKey | null>(null);
  const [error, setError] = useState<ErrorKey | null>(null);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [scene, setScene] = useState<string | null>(null);
  const video = useRef<HTMLVideoElement | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/projects/${projectId}`, { cache: "no-store" });
    if (!res.ok) return setLoadError(await apiError(res));
    setView((await res.json()) as View);
  }, [projectId]);

  useEffect(() => {
    void load();
    const es = new EventSource(`/api/projects/${projectId}/events?locale=${locale}`);
    let last = "";
    es.onmessage = (e) => {
      const ev = JSON.parse(e.data as string) as Live;
      setLive(ev);
      const key = `${ev.status}|${ev.headVersionId}`;
      if (key !== last) {
        last = key;
        void load();
      }
    };
    return () => es.close();
  }, [projectId, locale, load]);

  if (loadError) return <p className="error">{t(`errors.${loadError}`)}</p>;
  if (!view) return <p className="muted">…</p>;

  const status = live?.status ?? view.project.status;
  const settled = SETTLED.has(status);
  const output = view.outputs[0];

  async function act(body: object) {
    setError(null);
    const r = await postJson<{ id?: string }>(`/api/projects/${projectId}/actions`, body);
    if (!r.ok) return setError(r.error);
    if (r.data.id) return router.push(`/projects/${r.data.id}`);
    if ((body as { action: string }).action === "restore") working();
    void load();
  }

  /** A new render was queued: show progress right away (SSE confirms within a second). */
  function working() {
    setLive((l) => ({
      status: "producing_audio",
      text: null,
      fraction: 0,
      headVersionId: l?.headVersionId ?? null,
    }));
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim()) return;
    setSending(true);
    setError(null);
    const r = await postJson<{ kind: string }>(`/api/projects/${projectId}/chat`, { message });
    setSending(false);
    if (!r.ok) return setError(r.error);
    if (r.data.kind === "edit") working();
    setMessage("");
    void load();
  }

  function seek(sceneId: string) {
    setScene(sceneId);
    const s = view?.spec?.scenes.find((x) => x.id === sceneId);
    if (video.current && s?.timing) {
      video.current.currentTime = s.timing.startMs / 1000 + 0.05;
      void video.current.play().catch(() => undefined);
    }
  }

  return (
    <div className="stack">
      <div className="row">
        <h1 style={{ marginRight: "auto" }} data-testid="project-title">
          {view.project.title}
        </h1>
        <span className={`badge${status === "ready" ? " ok" : ""}`} data-testid="project-status">
          {t(`status.${status}`)}
        </span>
      </div>

      {!settled && !status.startsWith("awaiting") && (
        <div className="card stack" data-testid="progress">
          <strong>{live?.text ?? t("editor.working")}</strong>
          <div className="progress">
            <div style={{ width: `${Math.round((live?.fraction ?? 0) * 100)}%` }} />
          </div>
        </div>
      )}

      {status === "awaiting_script_review" && view.review && (
        <ScriptReview projectId={projectId} review={view.review} styles={styles} onDone={load} />
      )}
      {status === "awaiting_storyboard_review" && view.review && (
        <StoryboardReview projectId={projectId} scenes={view.review.scenes} onDone={load} />
      )}

      {view.spec && (
        <div className="editor">
          <section className="stack">
            <div className="card stack">
              <h2>{t("editor.preview")}</h2>
              {output?.video ? (
                <video
                  key={output.video}
                  ref={video}
                  className="player"
                  src={output.video}
                  poster={output.thumbnail ?? undefined}
                  controls
                  playsInline
                  data-testid="preview-video"
                />
              ) : (
                <p className="muted">{t("editor.noVideo")}</p>
              )}
              <h2>{t("editor.scenes")}</h2>
              <div className="strip" data-testid="scene-strip">
                {view.spec.scenes.map((s, i) => (
                  <button
                    type="button"
                    key={s.id}
                    className="scene"
                    aria-pressed={scene === s.id}
                    onClick={() => seek(s.id)}
                  >
                    {t("editor.scene", { n: i + 1 })}
                  </button>
                ))}
              </div>
            </div>
            <Downloads outputs={view.outputs} />
            {status === "ready" && view.spec && (
              <SaveTemplate projectId={projectId} title={view.project.title} />
            )}
          </section>

          <aside className="stack">
            <div className="card stack">
              <h2>{t("editor.chatTitle")}</h2>
              <div className="chat" data-testid="chat-log">
                {view.chat.length === 0 && <p className="muted small">{t("editor.chatEmpty")}</p>}
                {view.chat.map((m) => (
                  <div key={m.id} className={`bubble ${m.role}`}>
                    {m.content}
                  </div>
                ))}
              </div>
              <form onSubmit={send} className="stack">
                <textarea
                  name="message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={t("editor.chatPlaceholder")}
                  maxLength={1000}
                  style={{ minHeight: 64 }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      e.currentTarget.form?.requestSubmit();
                    }
                  }}
                />
                <button className="btn primary" type="submit" disabled={sending || !settled}>
                  {sending ? t("editor.sending") : t("editor.send")}
                </button>
              </form>
              {error && (
                <p className="error" role="alert" data-testid="action-error">
                  {t(`errors.${error}`)}
                </p>
              )}
              <div className="row">
                <button
                  className="btn"
                  disabled={!settled || !view.canUndo}
                  onClick={() => void act({ action: "undo" })}
                >
                  {t("editor.undo")}
                </button>
                <button
                  className="btn"
                  disabled={!settled || !view.canRedo}
                  onClick={() => void act({ action: "redo" })}
                >
                  {t("editor.redo")}
                </button>
                <button className="btn" disabled={!settled} onClick={() => void act({ action: "duplicate" })}>
                  {t("editor.duplicate")}
                </button>
              </div>
            </div>
            <VersionHistory
              versions={view.versions}
              head={view.project.headVersionId}
              disabled={!settled}
              onRestore={(versionId) => void act({ action: "restore", versionId })}
            />
          </aside>
        </div>
      )}
    </div>
  );
}
