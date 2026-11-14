"use client";
// Storyboard review: thumbnail grid, one keyframe per scene; untick scenes to drop them.
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ProjectView } from "@makvid/pipeline";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { postJson, type ErrorKey } from "@/lib/api-client";
import { cn } from "@/lib/utils";

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
    <Card data-testid="storyboard-review">
      <CardHeader>
        <CardTitle>{t("review.storyboardTitle")}</CardTitle>
        <p className="text-muted-foreground text-sm">{t("review.storyboardHint")}</p>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {scenes.map((s, i) => (
            <figure key={s.sceneId} className={cn("m-0 flex flex-col gap-2", drop.has(s.sceneId) && "opacity-40")}>
              <img src={`/api/projects/${projectId}/previews/${s.sceneId}`} alt={t("editor.scene", { n: i + 1 })} className="w-full rounded-md border object-cover" />
              <figcaption className="flex flex-col gap-1 text-sm">
                <strong>{t("editor.scene", { n: i + 1 })}</strong>
                <span className="text-muted-foreground">{s.text}</span>
                <Label className="font-normal">
                  <Checkbox checked={!drop.has(s.sceneId)} onCheckedChange={() => toggle(s.sceneId)} />
                  {t("review.keep")}
                </Label>
              </figcaption>
            </figure>
          ))}
        </div>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <Button className="w-fit" disabled={busy} onClick={() => void submit()}>
          {busy && <Loader2 className="size-4 motion-safe:animate-spin" aria-hidden />}
          {t("review.makeVideo")}
        </Button>
      </CardContent>
    </Card>
  );
}
