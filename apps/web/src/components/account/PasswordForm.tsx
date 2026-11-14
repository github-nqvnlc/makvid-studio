"use client";
import { useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useForm, type Resolver } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { authClient } from "@/lib/auth-client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Values = { current: string; next: string; confirm: string };

export function PasswordForm() {
  const t = useTranslations("account.password");
  const [hasPassword, setHasPassword] = useState<boolean | null>(null);
  const [revoke, setRevoke] = useState(false);

  // Accounts that only use Google have no password to change.
  useEffect(() => {
    void authClient
      .listAccounts()
      .then((r) => setHasPassword(Array.isArray(r.data) ? r.data.some((a) => a.providerId === "credential") : true))
      .catch(() => setHasPassword(true));
  }, []);

  const schema = useMemo(
    () =>
      z
        .object({
          current: z.string().min(1, t("currentRequired")),
          next: z.string().min(8, t("short")),
          confirm: z.string(),
        })
        .refine((v) => v.next === v.confirm, { path: ["confirm"], message: t("mismatch") }),
    [t],
  );
  const form = useForm<Values>({
    resolver: zodResolver(schema) as unknown as Resolver<Values>,
    defaultValues: { current: "", next: "", confirm: "" },
  });

  async function submit(v: Values) {
    const r = await authClient.changePassword({ currentPassword: v.current, newPassword: v.next, revokeOtherSessions: revoke });
    if (r.error) {
      // A wrong current password belongs under that field; anything else is a general failure.
      if (r.error.status === 400 || r.error.status === 401 || /invalid/i.test(r.error.message ?? "")) form.setError("current", { message: t("wrong") });
      else toast.error(t("failed"));
      return;
    }
    toast.success(t("saved"));
    form.reset();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
      </CardHeader>
      <CardContent>
        {hasPassword === false ? (
          <Alert>
            <AlertDescription>{t("socialOnly")}</AlertDescription>
          </Alert>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(submit)} className="flex max-w-md flex-col gap-4" noValidate>
              {(["current", "next", "confirm"] as const).map((k) => (
                <FormField
                  key={k}
                  control={form.control}
                  name={k}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t(k)}</FormLabel>
                      <FormControl>
                        <Input type="password" autoComplete={k === "current" ? "current-password" : "new-password"} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ))}
              <Label className="font-normal">
                <Checkbox checked={revoke} onCheckedChange={(v) => setRevoke(v === true)} />
                {t("signOutOthers")}
              </Label>
              <Button type="submit" disabled={form.formState.isSubmitting} className="w-fit" data-testid="password-save">
                {form.formState.isSubmitting && <Loader2 className="size-4 motion-safe:animate-spin" aria-hidden />}
                {t("save")}
              </Button>
            </form>
          </Form>
        )}
      </CardContent>
    </Card>
  );
}
