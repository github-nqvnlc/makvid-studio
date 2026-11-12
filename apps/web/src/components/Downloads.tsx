"use client";
// Downloads (T106): MP4 per aspect, SRT, thumbnail via short-lived signed URLs.
import { useTranslations } from "next-intl";
import type { ProjectView } from "@makvid/pipeline";

export function Downloads({ outputs }: { outputs: ProjectView["outputs"] }) {
  const t = useTranslations("editor");
  if (!outputs.length) return null;
  return (
    <div className="card stack" data-testid="downloads">
      <h2>{t("downloads")}</h2>
      <ul className="list">
        {outputs.map((o) => (
          <li key={o.aspect} className="row">
            {o.video && (
              <a className="btn" href={o.video} download>
                {t("video", { aspect: o.aspect })}
              </a>
            )}
            {o.srt && (
              <a className="btn" href={o.srt} download>
                {t("subtitles")}
              </a>
            )}
            {o.thumbnail && (
              <a className="btn" href={o.thumbnail} download>
                {t("thumbnail")}
              </a>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
