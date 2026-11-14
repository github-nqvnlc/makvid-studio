"use client";
// Create-video wizard: four titled sections (content, format, voice, mode) and a summary card with the quota check.
// Same fields, defaults, data-testids and POST body as the previous form.
import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { PageHeader } from "@/components/common/PageHeader";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { VoicePicker } from "@/components/VoicePicker";
import { apiError } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import type { VoiceOption } from "@/server/catalog";
import { AspectCards, type Aspect } from "./AspectCards";
import { CreateSummary } from "./CreateSummary";
import { DurationField } from "./DurationField";

const SOURCES = ["prompt", "script", "url", "github", "table", "media"] as const;
type SourceKind = (typeof SOURCES)[number];

function Choice({ pressed, onClick, testId, title, hint }: { pressed: boolean; onClick: () => void; testId: string; title: string; hint: string }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      data-testid={testId}
      className={cn("flex flex-col gap-1 rounded-lg border p-3 text-left transition-colors", pressed ? "border-primary ring-primary ring-1" : "hover:bg-muted")}
    >
      <span className="font-medium">{title}</span>
      <span className="text-muted-foreground text-xs">{hint}</span>
    </button>
  );
}

export function CreateForm({ voices, hasBrand = false }: { voices: VoiceOption[]; hasBrand?: boolean }) {
  const t = useTranslations("create");
  const te = useTranslations("errors");
  const ts = useTranslations("source");
  const router = useRouter();
  const [kind, setKind] = useState<SourceKind>("prompt");
  const [prompt, setPrompt] = useState("");
  const [script, setScript] = useState("");
  const [link, setLink] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [useSourceAudio, setUseSourceAudio] = useState(true);
  const [useBrand, setUseBrand] = useState(hasBrand);
  const [aspect, setAspect] = useState<Aspect>("9:16");
  const [durationSec, setDuration] = useState(45);
  const [mode, setMode] = useState<"auto" | "review">("auto");
  const [voiceId, setVoice] = useState(voices.find((v) => v.isDefault)?.id ?? voices[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (kind === "prompt" && prompt.trim().length < 3) return setError(t("tooShort"));
    if (kind === "script" && script.trim().length < 10) return setError(ts("scriptTooShort"));
    if ((kind === "url" || kind === "github") && !link.trim()) return setError(ts("linkMissing"));
    if ((kind === "table" || kind === "media") && !file) return setError(ts("fileMissing"));
    setBusy(true);
    setError(null);
    let res: Response;
    if (kind === "prompt")
      res = await fetch("/api/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt, aspect, durationSec, mode, voiceId, useBrand }),
      });
    else {
      const fd = new FormData();
      for (const [k, v] of Object.entries({ kind, aspect, durationSec: String(durationSec), mode, voiceId })) fd.set(k, v);
      fd.set("useBrand", String(useBrand));
      if (kind === "script") fd.set("text", script);
      if (kind === "url" || kind === "github") fd.set("url", link.trim());
      if (kind === "media") fd.set("useSourceAudio", String(useSourceAudio));
      if (file && (kind === "table" || kind === "media")) fd.set("file", file);
      res = await fetch("/api/projects", { method: "POST", body: fd });
    }
    if (!res.ok) {
      setBusy(false);
      return setError(te(await apiError(res)));
    }
    const { id } = (await res.json()) as { id: string };
    router.push(`/projects/${id}`);
  }

  return (
    <form onSubmit={submit} className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <PageHeader title={t("title")} />
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="flex min-w-0 flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>{t("sections.source")}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <fieldset>
                <legend className="sr-only">{ts("title")}</legend>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {SOURCES.map((k) => (
                    <Choice
                      key={k}
                      pressed={kind === k}
                      testId={`source-${k}`}
                      title={ts(`${k}.name`)}
                      hint={ts(`${k}.hint`)}
                      onClick={() => {
                        setKind(k);
                        setFile(null);
                      }}
                    />
                  ))}
                </div>
              </fieldset>
              {kind === "prompt" && (
                <div className="flex flex-col gap-2">
                  <Label htmlFor="prompt">{t("idea")}</Label>
                  <Textarea id="prompt" name="prompt" value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder={t("ideaPlaceholder")} maxLength={4000} className="min-h-28" />
                </div>
              )}
              {kind === "script" && (
                <div className="flex flex-col gap-2">
                  <Label htmlFor="script">{ts("script.label")}</Label>
                  <Textarea id="script" name="script" value={script} onChange={(e) => setScript(e.target.value)} placeholder={ts("script.placeholder")} maxLength={12000} className="min-h-44" />
                </div>
              )}
              {(kind === "url" || kind === "github") && (
                <div className="flex flex-col gap-2">
                  <Label htmlFor="link">{ts(`${kind}.label`)}</Label>
                  <Input id="link" name="link" type="url" inputMode="url" value={link} onChange={(e) => setLink(e.target.value)} placeholder={ts(`${kind}.placeholder`)} />
                </div>
              )}
              {(kind === "table" || kind === "media") && (
                <div className="flex flex-col gap-2">
                  <Label htmlFor="file">{ts(`${kind}.label`)}</Label>
                  <Input
                    id="file"
                    name="file"
                    type="file"
                    accept={kind === "table" ? ".csv,.json,text/csv,application/json" : "audio/*,video/*"}
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  />
                </div>
              )}
              {kind === "media" && (
                <Label className="font-normal">
                  <Checkbox checked={useSourceAudio} onCheckedChange={(v) => setUseSourceAudio(v === true)} />
                  {ts("media.useSourceAudio")}
                </Label>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("sections.format")}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              <AspectCards value={aspect} onChange={setAspect} />
              <DurationField value={durationSec} onChange={setDuration} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("sections.voice")}</CardTitle>
            </CardHeader>
            <CardContent>
              <VoicePicker voices={voices} value={voiceId} onChange={setVoice} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("sections.options")}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <fieldset>
                <legend className="sr-only">{t("mode")}</legend>
                <div className="grid gap-3 sm:grid-cols-2">
                  {(["auto", "review"] as const).map((m) => (
                    <Choice key={m} pressed={mode === m} testId={`mode-${m}`} title={t(m)} hint={t(m === "auto" ? "autoHint" : "reviewHint")} onClick={() => setMode(m)} />
                  ))}
                </div>
              </fieldset>
              {hasBrand && (
                <Label className="font-normal">
                  <Checkbox checked={useBrand} onCheckedChange={(v) => setUseBrand(v === true)} data-testid="use-brand" />
                  {t("useBrand")}
                </Label>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-3">
          {error && (
            <Alert variant="destructive" data-testid="create-error">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <CreateSummary
            duration={durationSec}
            aspect={aspect}
            mode={t(mode)}
            voice={voices.find((v) => v.id === voiceId)?.name ?? ""}
            busy={busy}
          />
        </div>
      </div>
    </form>
  );
}
