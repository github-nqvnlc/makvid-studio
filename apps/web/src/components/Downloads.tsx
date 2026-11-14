"use client";
// Downloads: MP4 per aspect, SRT, thumbnail via short-lived signed URLs.
import { Download } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ProjectView } from "@makvid/pipeline";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function Downloads({ outputs }: { outputs: ProjectView["outputs"] }) {
  const t = useTranslations("editor");
  if (!outputs.length) return null;
  const link = cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5");
  return (
    <Card data-testid="downloads">
      <CardHeader>
        <CardTitle className="text-base">{t("downloads")}</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col gap-2">
          {outputs.map((o) => (
            <li key={o.aspect} className="flex flex-wrap gap-2">
              {o.video && (
                <a className={link} href={o.video} download>
                  <Download className="size-4" aria-hidden />
                  {t("video", { aspect: o.aspect })}
                </a>
              )}
              {o.srt && (
                <a className={link} href={o.srt} download>
                  {t("subtitles")}
                </a>
              )}
              {o.thumbnail && (
                <a className={link} href={o.thumbnail} download>
                  {t("thumbnail")}
                </a>
              )}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
