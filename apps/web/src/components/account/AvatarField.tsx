"use client";
import { useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { apiError } from "@/lib/api-client";

const TYPES = ["image/png", "image/jpeg", "image/webp"];
const SIZE = 256;

/** Center-crop to a square and scale to 256 x 256 WebP in the browser (no server-side image library). */
async function cropToWebp(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, SIZE, SIZE);
  bitmap.close();
  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("blob"))), "image/webp", 0.9),
  );
}

export function AvatarField({ name, image }: { name: string; image: string | null }) {
  const t = useTranslations("account.avatar");
  const te = useTranslations("errors");
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [src, setSrc] = useState(image);

  async function pick(file: File | undefined) {
    if (!file) return;
    if (!TYPES.includes(file.type)) return toast.error(te("file_type"));
    setBusy(true);
    try {
      const blob = await cropToWebp(file).catch(() => null);
      if (!blob) return toast.error(t("unreadable"));
      const fd = new FormData();
      fd.set("file", blob, "avatar.webp");
      const res = await fetch("/api/me/avatar", { method: "POST", body: fd });
      if (!res.ok) return toast.error(te(await apiError(res)));
      setSrc(((await res.json()) as { image: string }).image);
      toast.success(t("saved"));
      router.refresh();
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  async function remove() {
    setBusy(true);
    try {
      const res = await fetch("/api/me/avatar", { method: "DELETE" });
      if (!res.ok) return toast.error(te("generic"));
      setSrc(null);
      toast.success(t("removed"));
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-4">
      <Avatar className="size-20">
        {src && <AvatarImage src={src} alt="" />}
        <AvatarFallback className="text-2xl">{(name || "?").slice(0, 1).toUpperCase()}</AvatarFallback>
      </Avatar>
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => input.current?.click()} data-testid="avatar-choose">
            {busy && <Loader2 className="size-4 motion-safe:animate-spin" aria-hidden />}
            {t("choose")}
          </Button>
          {src && (
            <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => void remove()}>
              {t("remove")}
            </Button>
          )}
        </div>
        <p className="text-muted-foreground text-xs">{t("hint")}</p>
        <input ref={input} type="file" accept={TYPES.join(",")} hidden data-testid="avatar-input" onChange={(e) => void pick(e.target.files?.[0])} />
      </div>
    </div>
  );
}
