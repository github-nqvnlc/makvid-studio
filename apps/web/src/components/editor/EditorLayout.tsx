"use client";
// Project editor: toolbar, progress, review screens while waiting for the user, then three panes
// (scenes + versions | preview + downloads | chat) that can be resized, or tabs on a phone.
// Live progress comes from the SSE endpoint, as before.
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import type { ProjectView } from "@makvid/pipeline";
import type { StyleCard } from "@/server/catalog";
import { ErrorState } from "@/components/common/ErrorState";
import { Downloads } from "@/components/Downloads";
import { SaveTemplate } from "@/components/SaveTemplate";
import { VersionHistory } from "@/components/VersionHistory";
import { Progress } from "@/components/ui/progress";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScriptReview } from "@/app/[locale]/(app)/projects/[id]/review/ScriptReview";
import { StoryboardReview } from "@/app/[locale]/(app)/projects/[id]/review/StoryboardReview";
import { useIsMobile } from "@/hooks/use-mobile";
import { useRouter } from "@/i18n/navigation";
import { apiError, postJson, type ErrorKey } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { ChatPanel } from "./ChatPanel";
import { EditorToolbar } from "./EditorToolbar";
import { PreviewPlayer } from "./PreviewPlayer";

type View = ProjectView;
interface Live {
  status: string;
  text: string | null;
  fraction: number;
  headVersionId: string | null;
}
const SETTLED = new Set(["ready", "needs_attention", "failed"]);

export function EditorLayout({ projectId, styles }: { projectId: string; styles: StyleCard[] }) {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const mobile = useIsMobile();
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
    setLoadError(null);
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

  if (loadError)
    return (
      <div className="mx-auto max-w-xl py-10">
        <ErrorState message={t(`errors.${loadError}`)} onRetry={() => void load()} />
      </div>
    );
  if (!view)
    return (
      <div className="flex flex-col gap-4" aria-busy>
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-96 w-full" />
      </div>
    );

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
    setLive((l) => ({ status: "producing_audio", text: null, fraction: 0, headVersionId: l?.headVersionId ?? null }));
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

  async function rename(title: string): Promise<boolean> {
    const res = await fetch(`/api/projects/${projectId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title }),
    });
    if (!res.ok) {
      toast.error(t(`errors.${await apiError(res)}`));
      return false;
    }
    toast.success(t("editor.renamed"));
    void load();
    return true;
  }

  function seek(sceneId: string) {
    setScene(sceneId);
    const s = view?.spec?.scenes.find((x) => x.id === sceneId);
    if (video.current && s?.timing) {
      video.current.currentTime = s.timing.startMs / 1000 + 0.05;
      void video.current.play().catch(() => undefined);
    }
  }

  const preview = (
    <div className="flex flex-col gap-4">
      <PreviewPlayer ref={video} src={output?.video ?? null} poster={output?.thumbnail ?? null} aspect={output?.aspect} />
      <Downloads outputs={view.outputs} />
      {status === "ready" && view.spec && <SaveTemplate projectId={projectId} title={view.project.title} />}
    </div>
  );
  const scenes = view.spec && (
    <div className="flex flex-col gap-4">
      <h2 className="text-sm font-semibold">{t("editor.scenes")}</h2>
      <div className="flex flex-wrap gap-2 md:flex-col" data-testid="scene-strip">
        {view.spec.scenes.map((s, i) => (
          <button
            type="button"
            key={s.id}
            aria-pressed={scene === s.id}
            onClick={() => seek(s.id)}
            className={cn("rounded-md border px-3 py-2 text-left text-sm", scene === s.id ? "border-primary ring-primary ring-1" : "hover:bg-muted")}
          >
            {t("editor.scene", { n: i + 1 })}
          </button>
        ))}
      </div>
      <VersionHistory versions={view.versions} head={view.project.headVersionId} disabled={!settled} onRestore={(id) => void act({ action: "restore", versionId: id })} />
    </div>
  );
  const chat = (
    <ChatPanel chat={view.chat} message={message} onMessage={setMessage} onSend={send} sending={sending} settled={settled} error={error} />
  );

  return (
    <div className="flex flex-col gap-4">
      <EditorToolbar
        title={view.project.title}
        status={status}
        settled={settled}
        canUndo={view.canUndo}
        canRedo={view.canRedo}
        onRename={rename}
        onAction={(a) => void act({ action: a })}
      />

      {!settled && !status.startsWith("awaiting") && (
        <div className="bg-card flex flex-col gap-2 rounded-lg border p-4" data-testid="progress" aria-live="polite">
          <strong className="text-sm">{live?.text ?? t("editor.working")}</strong>
          <Progress value={Math.round((live?.fraction ?? 0) * 100)} aria-label={t("editor.working")} />
        </div>
      )}

      {status === "awaiting_script_review" && view.review && (
        <ScriptReview projectId={projectId} review={view.review} styles={styles} onDone={load} />
      )}
      {status === "awaiting_storyboard_review" && view.review && (
        <StoryboardReview projectId={projectId} scenes={view.review.scenes} onDone={load} />
      )}

      {view.spec &&
        (mobile ? (
          <Tabs defaultValue="preview">
            <TabsList className="w-full">
              <TabsTrigger value="preview">{t("editor.tabs.preview")}</TabsTrigger>
              <TabsTrigger value="scenes">{t("editor.tabs.scenes")}</TabsTrigger>
              <TabsTrigger value="chat">{t("editor.tabs.chat")}</TabsTrigger>
            </TabsList>
            <TabsContent value="preview">{preview}</TabsContent>
            <TabsContent value="scenes">{scenes}</TabsContent>
            <TabsContent value="chat" className="h-[70svh]">
              {chat}
            </TabsContent>
          </Tabs>
        ) : (
          <ResizablePanelGroup orientation="horizontal" className="min-h-[32rem] gap-0 rounded-lg border" aria-label={t("editor.panes")}>
            <ResizablePanel defaultSize="22%" minSize="15%">
              <div className="h-full overflow-y-auto p-4">{scenes}</div>
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize="40%" minSize="25%">
              <div className="h-full overflow-y-auto p-4">{preview}</div>
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize="38%" minSize="22%">
              <div className="h-full p-4">{chat}</div>
            </ResizablePanel>
          </ResizablePanelGroup>
        ))}
    </div>
  );
}
