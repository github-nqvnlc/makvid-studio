"use client";
// Version history: newest first; restore puts an older version on top (history is kept).
import { useFormatter, useTranslations } from "next-intl";
import type { ProjectView } from "@makvid/pipeline";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
    <Card data-testid="versions">
      <CardHeader>
        <CardTitle className="text-base">{t("versions")}</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col gap-3">
          {[...versions].reverse().map((v) => (
            <li key={v.id} className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="font-medium">{t("version", { n: v.seq })}</div>
                <div className="text-muted-foreground text-xs">
                  {v.author === "user" ? t("byYou") : t("byAi")} ·{" "}
                  {format.dateTime(new Date(v.createdAt), { dateStyle: "short", timeStyle: "short" })}
                </div>
              </div>
              {v.id === head ? (
                <Badge>{t("current")}</Badge>
              ) : (
                <Button variant="outline" size="sm" disabled={disabled} onClick={() => onRestore(v.id)}>
                  {t("restore")}
                </Button>
              )}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
