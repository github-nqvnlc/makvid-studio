"use client";
// Accept a workspace invitation (US6), then go to the projects of that workspace.
import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";

export function AcceptInvite({ token, email }: { token: string; email: string }) {
  const t = useTranslations("invite");
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  async function accept() {
    const res = await fetch("/api/invitations/accept", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token }),
    });
    if (res.ok) {
      router.push("/");
      router.refresh();
      return;
    }
    const b = (await res.json().catch(() => null)) as { error?: string } | null;
    setError(b?.error === "email_mismatch" ? t("email_mismatch", { email }) : t("invalid"));
  }
  return (
    <div className="stack">
      <button className="btn primary" onClick={() => void accept()} data-testid="accept-invite">
        {t("accept")}
      </button>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
