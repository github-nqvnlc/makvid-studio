"use client";
import { forwardRef, useState } from "react";
import { Film } from "lucide-react";
import { useTranslations } from "next-intl";
import { ErrorState } from "@/components/common/ErrorState";
import { Skeleton } from "@/components/ui/skeleton";

/** "9:16" -> CSS aspect-ratio "9 / 16". Unknown values fall back to landscape. */
const ratio = (a: string | undefined) => (a && /^\d+:\d+$/.test(a) ? a.replace(":", " / ") : "16 / 9");

/**
 * Video in a frame that has the project's real shape (a vertical video is shown vertical, never stretched), with a
 * poster, a loading state and an error state with a retry button.
 */
export const PreviewPlayer = forwardRef<
  HTMLVideoElement,
  { src: string | null; poster: string | null; aspect: string | undefined }
>(function PreviewPlayer({ src, poster, aspect }, ref) {
  const t = useTranslations("editor");
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [attempt, setAttempt] = useState(0);
  const tall = aspect ? Number(aspect.split(":")[1]) > Number(aspect.split(":")[0]) : false;

  if (!src)
    return (
      <div className="bg-muted text-muted-foreground flex aspect-video flex-col items-center justify-center gap-2 rounded-lg p-6 text-center text-sm">
        <Film className="size-8" aria-hidden />
        {t("noVideo")}
      </div>
    );

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className="bg-muted relative w-full overflow-hidden rounded-lg"
        style={{ aspectRatio: ratio(aspect), maxHeight: "70vh", maxWidth: tall ? "min(100%, 360px)" : "100%" }}
      >
        {state === "loading" && <Skeleton className="absolute inset-0" aria-label={t("loadingVideo")} />}
        <video
          key={`${src}#${attempt}`}
          ref={ref}
          className="size-full object-contain"
          src={src}
          poster={poster ?? undefined}
          controls
          playsInline
          onLoadedData={() => setState("ready")}
          onError={() => setState("error")}
          data-testid="preview-video"
        />
        {state === "error" && (
          <div className="bg-background/90 absolute inset-0 flex items-center justify-center p-3">
            <ErrorState
              message={t("videoError")}
              onRetry={() => {
                setState("loading");
                setAttempt((n) => n + 1);
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
});
