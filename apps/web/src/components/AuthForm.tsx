"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { authClient } from "@/lib/auth-client";

export function AuthForm({ mode, google }: { mode: "sign-in" | "sign-up"; google: boolean }) {
  const t = useTranslations("auth");
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(form: FormData) {
    setBusy(true);
    setError(null);
    const email = String(form.get("email") ?? "");
    const password = String(form.get("password") ?? "");
    const r =
      mode === "sign-up"
        ? await authClient.signUp.email({ email, password, name: String(form.get("name") ?? "") })
        : await authClient.signIn.email({ email, password });
    setBusy(false);
    if (r.error) {
      setError(mode === "sign-up" ? t("signUpFailed") : t("failed"));
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <form action={submit} className="card stack" style={{ maxWidth: 420 }}>
      <h1>{mode === "sign-up" ? t("signUpTitle") : t("signInTitle")}</h1>
      {mode === "sign-up" && (
        <label>
          {t("name")}
          <input name="name" required autoComplete="name" />
        </label>
      )}
      <label>
        {t("email")}
        <input name="email" type="email" required autoComplete="email" />
      </label>
      <label>
        {t("password")}
        <input
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
        />
      </label>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <button className="btn primary" disabled={busy} type="submit">
        {mode === "sign-up" ? t("signUp") : t("signIn")}
      </button>
      {google && (
        <button
          type="button"
          className="btn"
          onClick={() => void authClient.signIn.social({ provider: "google", callbackURL: "/" })}
        >
          {t("google")}
        </button>
      )}
      <Link href={mode === "sign-up" ? "/sign-in" : "/sign-up"} className="small">
        {mode === "sign-up" ? t("toSignIn") : t("toSignUp")}
      </Link>
    </form>
  );
}
