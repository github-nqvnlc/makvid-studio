"use client";
import { useRef, useState } from "react";
import { UploadCloud } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

/** Drag-and-drop plus button (keyboard reachable). Validates type and size before calling onFile. */
export function FileDropzone({
  accept,
  maxSize,
  onFile,
  label,
}: {
  accept: string[];
  maxSize: number;
  onFile: (file: File) => void;
  label: string;
}) {
  const t = useTranslations("common");
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);

  function take(file: File | undefined) {
    if (!file) return;
    if (!accept.some((a) => (a.endsWith("/*") ? file.type.startsWith(a.slice(0, -1)) : file.type === a))) {
      setError(t("dropzone.type"));
      return;
    }
    if (file.size > maxSize) {
      setError(t("dropzone.size", { mb: Math.round(maxSize / 1_000_000) }));
      return;
    }
    setError(null);
    setName(file.name);
    onFile(file);
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        take(e.dataTransfer.files[0]);
      }}
      className={cn("flex flex-col items-center gap-2 rounded-lg border border-dashed p-6 text-center", over && "bg-accent")}
    >
      <UploadCloud className="text-muted-foreground size-6" aria-hidden />
      <button type="button" className="text-sm font-medium underline" onClick={() => input.current?.click()}>
        {label}
      </button>
      <p className="text-muted-foreground text-xs">{t("dropzone.hint")}</p>
      {name && <p className="truncate text-sm">{name}</p>}
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      <input ref={input} type="file" hidden accept={accept.join(",")} onChange={(e) => take(e.target.files?.[0])} />
    </div>
  );
}
