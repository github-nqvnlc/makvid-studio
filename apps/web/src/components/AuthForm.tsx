"use client";
import { useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useForm, type Resolver } from "react-hook-form";
import { z } from "zod";
import { Link, useRouter } from "@/i18n/navigation";
import { authClient } from "@/lib/auth-client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";

type Values = { name?: string; email: string; password: string };

export function AuthForm({ mode, google }: { mode: "sign-in" | "sign-up"; google: boolean }) {
  const t = useTranslations("auth");
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [show, setShow] = useState(false);
  // Messages are translated here so zod text never reaches the screen.
  const schema = useMemo(
    () =>
      z.object({
        name: mode === "sign-up" ? z.string().trim().min(1, t("nameRequired")) : z.string().optional(),
        email: z.email(t("emailInvalid")),
        password: z.string().min(8, t("passwordShort")),
      }),
    [mode, t],
  );
  const form = useForm<Values>({
    resolver: zodResolver(schema) as unknown as Resolver<Values>,
    defaultValues: { name: "", email: "", password: "" },
  });
  const pending = form.formState.isSubmitting;

  async function submit(values: Values) {
    setError(null);
    const r =
      mode === "sign-up"
        ? await authClient.signUp.email({ email: values.email, password: values.password, name: values.name ?? "" })
        : await authClient.signIn.email({ email: values.email, password: values.password });
    if (r.error) {
      setError(mode === "sign-up" ? t("signUpFailed") : t("failed"));
      return;
    }
    // Only same-site relative paths (e.g. an invitation link) are honoured after sign-in.
    const next = new URLSearchParams(window.location.search).get("next");
    // After sign-in the profile language wins over the one in the URL (spec FR-010 rule 1).
    const saved = (r.data as { user?: { locale?: string } } | null)?.user?.locale;
    const target = next && /^\/(?!\/)[\w\-/]*$/.test(next) ? next : "/";
    router.push(
      target as Parameters<typeof router.push>[0],
      saved === "vi" || saved === "en" ? { locale: saved } : undefined,
    );
    router.refresh();
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(submit)} className="flex flex-col gap-5" noValidate>
        <h1 className="text-2xl font-bold tracking-tight">{mode === "sign-up" ? t("signUpTitle") : t("signInTitle")}</h1>
        {mode === "sign-up" && (
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("name")}</FormLabel>
                <FormControl>
                  <Input autoComplete="name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("email")}</FormLabel>
              <FormControl>
                <Input type="email" autoComplete="email" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field, fieldState }) => (
            <FormItem>
              <FormLabel>{t("passwordLabel")}</FormLabel>
              <div className="relative">
                <FormControl>
                  <Input
                    type={show ? "text" : "password"}
                    autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
                    className="pr-10"
                    {...field}
                  />
                </FormControl>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute top-0 right-0"
                  aria-label={show ? t("hidePassword") : t("showPassword")}
                  onClick={() => setShow((s) => !s)}
                >
                  {show ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
                </Button>
              </div>
              {mode === "sign-up" && !fieldState.error && (
                <p className="text-muted-foreground text-xs">{t("passwordHint")}</p>
              )}
              <FormMessage />
            </FormItem>
          )}
        />
        {error && (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="size-4 motion-safe:animate-spin" aria-hidden />}
          {mode === "sign-up" ? t("signUp") : t("signIn")}
        </Button>
        {google && (
          <Button
            type="button"
            variant="outline"
            onClick={() => void authClient.signIn.social({ provider: "google", callbackURL: "/" })}
          >
            {t("google")}
          </Button>
        )}
        <Link href={mode === "sign-up" ? "/sign-in" : "/sign-up"} className="text-sm underline underline-offset-4">
          {mode === "sign-up" ? t("toSignIn") : t("toSignUp")}
        </Link>
      </form>
    </Form>
  );
}
