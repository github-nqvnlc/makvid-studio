"use client";
// Version history (T105): newest first; restore puts an older version on top (history is kept).
import { useFormatter, useTranslations } from "next-intl";
import type { ProjectView } from "@makvid/pipeline";

export function VersionHistory({
  versions,
  head,
  disabled,
  onRestore,
}: {
  versions: ProjectView["versions"];
  head: string | null;
  disabled: boolean;
  onRestore: (versionId: string) => void;
}) {
  const t = useTranslations("editor");
  const format = useFormatter();
  if (!versions.length) return null;
  return (
    <div className="card stack" data-testid="versions">
      <h2>{t("versions")}</h2>
      <ul className="list">
        {[...versions].reverse().map((v) => (
          <li key={v.id}>
            <div>
              <strong>{t("version", { n: v.seq })}</strong>
              <div className="muted small">
                {v.author === "user" ? t("byYou") : t("byAi")} ·{" "}
                {format.dateTime(new Date(v.createdAt), { dateStyle: "short", timeStyle: "short" })}
              </div>
            </div>
            {v.id === head ? (
              <span className="badge ok">{t("current")}</span>
            ) : (
              <button className="btn small" disabled={disabled} onClick={() => onRestore(v.id)}>
                {t("restore")}
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
