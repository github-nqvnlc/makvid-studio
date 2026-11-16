"use client";
// The voice button and its dialog: listen to any voice, pick one, confirm. Dismissing keeps the old choice.
import { useState } from "react";
import { Mic } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { VoicePicker } from "@/components/VoicePicker";
import type { VoiceOption } from "@/server/catalog";

export function VoiceDialog({
  voices,
  value,
  onChange,
}: {
  voices: VoiceOption[];
  value: string;
  onChange: (id: string) => void;
}) {
  const t = useTranslations("create.composer");
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const current = voices.find((v) => v.id === value);
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (o) setDraft(value);
        setOpen(o);
      }}
    >
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          disabled={voices.length === 0}
          data-testid="voice-button"
        >
          <Mic className="size-3.5" aria-hidden />
          <span className="max-w-32 truncate">{current?.name ?? t("noVoice")}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("voiceTitle")}</DialogTitle>
          <DialogDescription>{t("voiceHint")}</DialogDescription>
        </DialogHeader>
        <VoicePicker voices={voices} value={draft} onChange={setDraft} />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            {t("cancel")}
          </Button>
          <Button
            type="button"
            data-testid="voice-confirm"
            onClick={() => {
              onChange(draft);
              setOpen(false);
            }}
          >
            {t("useVoice")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
