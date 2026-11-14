"use client";
// Script review: edit the title and each voice-over sentence, pick one of the suggested styles
// (thumbnail + reason), then continue.
import { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ProjectView } from "@makvid/pipeline";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { postJson, type ErrorKey } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import type { StyleCard } from "@/server/catalog";

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
    <Card data-testid="script-review">
      <CardHeader>
        <CardTitle>{t("review.scriptTitle")}</CardTitle>
        <p className="text-muted-foreground text-sm">{t("review.scriptHint")}</p>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="review-title">{t("review.videoTitle")}</Label>
          <Input id="review-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
        </div>
        {sentences.map((s, i) => (
          <div key={i} className="flex flex-col gap-2">
            <Label htmlFor={`sentence-${i}`}>{t("review.sentence", { n: i + 1 })}</Label>
            <Textarea
              id={`sentence-${i}`}
              value={s}
              maxLength={400}
              className="min-h-14"
              onChange={(e) => setSentences(sentences.map((x, j) => (j === i ? e.target.value : x)))}
            />
          </div>
        ))}
        <h3 className="text-sm font-semibold">{t("review.styles")}</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {review.styleSuggestions.map((s) => (
            <button
              key={s.styleId}
              type="button"
              aria-pressed={styleId === s.styleId}
              onClick={() => setStyle(s.styleId)}
              data-testid={`style-${s.styleId}`}
              className={cn("flex flex-col gap-2 rounded-lg border p-3 text-left", styleId === s.styleId ? "border-primary ring-primary ring-1" : "hover:bg-muted")}
            >
              <img src={`/api/styles/${s.styleId}/thumbnail`} alt="" className="aspect-video w-full rounded object-cover" />
              <span className="flex items-center gap-2 font-medium">
                {byId.get(s.styleId)?.name ?? s.styleId}
                {styleId === s.styleId && (
                  <Badge className="gap-1">
                    <Check className="size-3" aria-hidden />
                    {t("review.chosen")}
                  </Badge>
                )}
              </span>
              <span className="text-muted-foreground text-xs">{s.reason}</span>
            </button>
          ))}
        </div>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{t(`errors.${error}`)}</AlertDescription>
          </Alert>
        )}
        <Button className="w-fit" disabled={busy} onClick={() => void submit()}>
          {busy && <Loader2 className="size-4 motion-safe:animate-spin" aria-hidden />}
          {t("review.continue")}
        </Button>
      </CardContent>
    </Card>
  );
}
