"use client";
import { useEffect, useRef } from "react";
import { Loader2, Send } from "lucide-react";
import { useTranslations } from "next-intl";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { ErrorKey } from "@/lib/api-client";
import { cn } from "@/lib/utils";

export interface ChatMessage {
  id: string;
  role: string;
  content: string;
}

/** Chat log (always visible, scrolls inside its pane) and the message box. */
export function ChatPanel({
  chat,
  message,
  onMessage,
  onSend,
  sending,
  settled,
  error,
}: {
  chat: ChatMessage[];
  message: string;
  onMessage: (v: string) => void;
  onSend: (e: React.FormEvent) => void;
  sending: boolean;
  settled: boolean;
  error: ErrorKey | null;
}) {
  const t = useTranslations("editor");
  const te = useTranslations("errors");
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [chat.length]);

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <h2 className="text-sm font-semibold">{t("chatTitle")}</h2>
      <div className="flex min-h-40 flex-1 flex-col gap-2 overflow-y-auto pr-1" data-testid="chat-log" aria-live="polite">
        {chat.length === 0 && <p className="text-muted-foreground text-sm">{t("chatEmpty")}</p>}
        {chat.map((m) => (
          <div
            key={m.id}
            data-role={m.role}
            className={cn(
              "bubble max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap",
              m.role,
              m.role === "user" ? "bg-primary text-primary-foreground self-end" : "bg-muted self-start",
            )}
          >
            {m.content}
          </div>
        ))}
        <div ref={end} />
      </div>
      <form onSubmit={onSend} className="flex flex-col gap-2">
        <Textarea
          name="message"
          value={message}
          onChange={(e) => onMessage(e.target.value)}
          placeholder={t("chatPlaceholder")}
          maxLength={1000}
          className="min-h-16"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              e.currentTarget.form?.requestSubmit();
            }
          }}
        />
        <Button type="submit" disabled={sending || !settled} className="gap-2">
          {sending ? <Loader2 className="size-4 motion-safe:animate-spin" aria-hidden /> : <Send className="size-4" aria-hidden />}
          {sending ? t("sending") : t("send")}
        </Button>
      </form>
      {error && (
        <Alert variant="destructive" data-testid="action-error">
          <AlertDescription>{te(error)}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
