"use client";
import { Suspense } from "react";
import { Globe } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing, type AppLocale } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const NAMES: Record<AppLocale, string> = { vi: "Tiếng Việt", en: "English" };

function Inner({ signedIn }: { signedIn: boolean }) {
  const t = useTranslations("common.language");
  const locale = useLocale() as AppLocale;
  const pathname = usePathname();
  const router = useRouter();
  const search = useSearchParams();

  function change(next: string) {
    if (next === locale) return;
    const query = Object.fromEntries(search.entries());
    // Signed-in users also keep the choice in their profile (spec FR-010); a failure never blocks the switch.
    if (signedIn)
      void fetch("/api/me", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ locale: next }),
      }).catch(() => undefined);
    router.replace({ pathname, query } as Parameters<typeof router.replace>[0], { locale: next as AppLocale });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" aria-label={t("label")} data-testid="locale-switcher" className="gap-1.5">
          <Globe className="size-4" aria-hidden />
          <span>{locale.toUpperCase()}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup value={locale} onValueChange={change}>
          {routing.locales.map((l) => (
            <DropdownMenuRadioItem key={l} value={l} lang={l}>
              {NAMES[l]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function LocaleSwitcher({ signedIn = false }: { signedIn?: boolean }) {
  return (
    <Suspense fallback={null}>
      <Inner signedIn={signedIn} />
    </Suspense>
  );
}
