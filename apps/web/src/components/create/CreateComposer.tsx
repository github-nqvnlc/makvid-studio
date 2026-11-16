"use client";
// Create-video composer (spec 003): one chat-like box for every kind of content, with compact controls for
// the type, aspect ratio, length, voice and mode, and a summary with the start button. Same POST body as
// the previous form, so the API and the quota rules are unchanged.
import { useRef, useState } from "react";
import { Paperclip, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { PageHeader } from "@/components/common/PageHeader";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiError } from "@/lib/api-client";
import type { VoiceOption } from "@/server/catalog";
import { AspectSelect, type Aspect } from "./AspectSelect";
import { ContentTypeSelect } from "./ContentTypeSelect";
import { CreateSummary } from "./CreateSummary";
import { LengthInput } from "./LengthInput";
import { ModeToggle, type Mode } from "./ModeToggle";
import { VoiceDialog } from "./VoiceDialog";
import {
  parseLength,
  PROMPT_MAX,
  SCRIPT_MAX,
  validateContent,
  type ContentError,
  type SourceKind,
} from "./validation";

const ERROR_KEY: Record<ContentError, { ns: "create" | "source" | "create.composer"; key: string }> = {
  tooShort: { ns: "create", key: "tooShort" },
  scriptTooShort: { ns: "source", key: "scriptTooShort" },
  linkMissing: { ns: "source", key: "linkMissing" },
  linkInvalid: { ns: "create.composer", key: "linkInvalid" },
  fileMissing: { ns: "source", key: "fileMissing" },
  fileKind: { ns: "create.composer", key: "fileKind" },
};

export function CreateComposer({ voices, hasBrand = false }: { voices: VoiceOption[]; hasBrand?: boolean }) {
  const t = useTranslations("create");
  const tc = useTranslations("create.composer");
  const te = useTranslations("errors");
  const ts = useTranslations("source");
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement | null>(null);
  const [kind, setKind] = useState<SourceKind>("prompt");
  // Every type keeps its own value while the user switches (FR-012).
  const [prompt, setPrompt] = useState("");
  const [script, setScript] = useState("");
  const [link, setLink] = useState("");
  const [files, setFiles] = useState<Partial<Record<"table" | "media", File>>>({});
  const [useSourceAudio, setUseSourceAudio] = useState(true);
  const [useBrand, setUseBrand] = useState(hasBrand);
  const [aspect, setAspect] = useState<Aspect>("9:16");
  const [lengthRaw, setLengthRaw] = useState("45");
  const [mode, setMode] = useState<Mode>("auto");
  const [voiceId, setVoice] = useState(voices.find((v) => v.isDefault)?.id ?? voices[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const file = kind === "table" || kind === "media" ? (files[kind] ?? null) : null;
  const durationSec = parseLength(lengthRaw);
  const voice = voices.find((v) => v.id === voiceId);
  const preview =
    kind === "prompt" ? prompt.trim() : kind === "script" ? script.trim() : file ? file.name : link.trim();

  function messageFor(e: ContentError): string {
    const m = ERROR_KEY[e];
    return m.ns === "create" ? t(m.key) : m.ns === "source" ? ts(m.key) : tc(m.key);
  }

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    if (busy) return; // one request only, however many clicks
    if (durationSec === null) return setError(t("durationHint"));
    if (!voiceId) return setError(tc("noVoice"));
    const bad = validateContent(kind, { prompt, script, link, file });
    if (bad) return setError(messageFor(bad));
    setBusy(true);
    setError(null);
    try {
      let res: Response;
      if (kind === "prompt")
        res = await fetch("/api/projects", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ prompt, aspect, durationSec, mode, voiceId, useBrand }),
        });
      else {
        const fd = new FormData();
        for (const [k, v] of Object.entries({ kind, aspect, durationSec: String(durationSec), mode, voiceId }))
          fd.set(k, v);
        fd.set("useBrand", String(useBrand));
        if (kind === "script") fd.set("text", script);
        if (kind === "url" || kind === "github") fd.set("url", link.trim());
        if (kind === "media") fd.set("useSourceAudio", String(useSourceAudio));
        if (file) fd.set("file", file);
        res = await fetch("/api/projects", { method: "POST", body: fd });
      }
      if (!res.ok) {
        setBusy(false);
        return setError(te(await apiError(res)));
      }
      const { id } = (await res.json()) as { id: string };
      router.push(`/projects/${id}`);
    } catch {
      setBusy(false);
      setError(te("generic"));
    }
  }

  return (
    <form onSubmit={submit} noValidate className="mx-auto flex w-full max-w-6xl flex-col gap-6" data-testid="composer">
      <PageHeader title={t("title")} />
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="bg-card flex min-w-0 flex-col rounded-2xl border shadow-sm">
          <div className="flex flex-col gap-2 p-4" data-testid="composer-input">
            {kind === "prompt" && (
              <>
                <Label htmlFor="prompt" className="sr-only">
                  {t("idea")}
                </Label>
                <Textarea
                  id="prompt"
                  name="prompt"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder={t("ideaPlaceholder")}
                  maxLength={PROMPT_MAX}
                  className="min-h-40 resize-none border-0 bg-transparent p-0 shadow-none focus-visible:ring-0 dark:bg-transparent"
                />
                <span className="text-muted-foreground self-end text-xs">
                  {prompt.length}/{PROMPT_MAX}
                </span>
              </>
            )}
            {kind === "script" && (
              <>
                <Label htmlFor="script" className="sr-only">
                  {ts("script.label")}
                </Label>
                <Textarea
                  id="script"
                  name="script"
                  value={script}
                  onChange={(e) => setScript(e.target.value)}
                  placeholder={ts("script.placeholder")}
                  maxLength={SCRIPT_MAX}
                  className="min-h-56 resize-none border-0 bg-transparent p-0 shadow-none focus-visible:ring-0 dark:bg-transparent"
                />
                <span className="text-muted-foreground self-end text-xs">
                  {script.length}/{SCRIPT_MAX}
                </span>
              </>
            )}
            {(kind === "url" || kind === "github") && (
              <>
                <Label htmlFor="link" className="sr-only">
                  {ts(`${kind}.label`)}
                </Label>
                <Input
                  id="link"
                  name="link"
                  type="url"
                  inputMode="url"
                  value={link}
                  onChange={(e) => setLink(e.target.value)}
                  placeholder={ts(`${kind}.placeholder`)}
                  className="h-12 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0 dark:bg-transparent"
                />
              </>
            )}
            {(kind === "table" || kind === "media") && (
              <div className="flex min-h-28 flex-col items-start justify-center gap-3">
                <p className="text-muted-foreground text-sm">{ts(`${kind}.label`)}</p>
                <input
                  ref={fileInput}
                  id="file"
                  name="file"
                  type="file"
                  className="sr-only"
                  tabIndex={-1}
                  accept={kind === "table" ? ".csv,.json,text/csv,application/json" : "audio/*,video/*"}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    setFiles((p) => ({ ...p, [kind]: f }));
                  }}
                />
                {file ? (
                  <span className="bg-muted inline-flex max-w-full items-center gap-2 rounded-full py-1 pr-1 pl-3 text-sm">
                    <span className="truncate" data-testid="file-chip">
                      {file.name}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-6 rounded-full"
                      aria-label={tc("removeFile")}
                      onClick={() => {
                        setFiles((p) => ({ ...p, [kind]: undefined }));
                        if (fileInput.current) fileInput.current.value = "";
                      }}
                    >
                      <X className="size-3.5" aria-hidden />
                    </Button>
                  </span>
                ) : (
                  <Button type="button" variant="outline" size="sm" onClick={() => fileInput.current?.click()}>
                    <Paperclip className="size-4" aria-hidden />
                    {tc("attach")}
                  </Button>
                )}
              </div>
            )}
            {kind === "media" && (
              <Label className="font-normal">
                <Checkbox checked={useSourceAudio} onCheckedChange={(v) => setUseSourceAudio(v === true)} />
                {ts("media.useSourceAudio")}
              </Label>
            )}
          </div>
          <div className="flex flex-wrap items-start gap-x-3 gap-y-3 border-t p-3" data-testid="composer-controls">
            <ContentTypeSelect value={kind} onChange={setKind} />
            <AspectSelect value={aspect} onChange={setAspect} />
            <LengthInput value={lengthRaw} onChange={setLengthRaw} />
            <VoiceDialog voices={voices} value={voiceId} onChange={setVoice} />
            <div className="ml-auto">
              <ModeToggle value={mode} onChange={setMode} />
            </div>
            {hasBrand && (
              <Label className="w-full font-normal">
                <Checkbox
                  checked={useBrand}
                  onCheckedChange={(v) => setUseBrand(v === true)}
                  data-testid="use-brand"
                />
                {t("useBrand")}
              </Label>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-3">
          {error && (
            <Alert variant="destructive" data-testid="create-error">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <CreateSummary
            typeName={ts(`${kind}.name`)}
            preview={preview}
            duration={durationSec}
            aspect={aspect}
            mode={t(mode)}
            voice={voice?.name ?? ""}
            brand={hasBrand ? useBrand : null}
            busy={busy}
            disabledReason={durationSec === null ? t("durationHint") : !voiceId ? tc("noVoice") : null}
          />
        </div>
      </div>
    </form>
  );
}
