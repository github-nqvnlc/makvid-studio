"use client";
import { useMemo } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useForm, type Resolver } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { useRouter } from "@/i18n/navigation";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { AvatarField } from "./AvatarField";

type Values = { name: string };

export function ProfileForm({ name, email, image }: { name: string; email: string; image: string | null }) {
  const t = useTranslations("account.profile");
  const router = useRouter();
  const schema = useMemo(
    () => z.object({ name: z.string().transform((s) => s.normalize("NFC").trim()).pipe(z.string().min(1, t("nameRequired")).max(80, t("nameTooLong"))) }),
    [t],
  );
  const form = useForm<Values>({ resolver: zodResolver(schema) as unknown as Resolver<Values>, defaultValues: { name } });

  async function submit(v: Values) {
    const r = await authClient.updateUser({ name: schema.parse(v).name });
    if (r.error) return toast.error(t("failed"));
    toast.success(t("saved"));
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <AvatarField name={name} image={image} />
        <Form {...form}>
          <form onSubmit={form.handleSubmit(submit)} className="flex max-w-md flex-col gap-4" noValidate>
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
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">{t("email")}</span>
              <Input value={email} readOnly aria-readonly aria-label={t("email")} className="text-muted-foreground" />
            </div>
            <Button type="submit" disabled={form.formState.isSubmitting} className="w-fit" data-testid="profile-save">
              {form.formState.isSubmitting && <Loader2 className="size-4 motion-safe:animate-spin" aria-hidden />}
              {t("save")}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
