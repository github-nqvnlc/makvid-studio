import type { ReactNode } from "react";
import { Clapperboard } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { LocaleSwitcher } from "@/components/common/LocaleSwitcher";
import { ThemeToggle } from "@/components/common/ThemeToggle";

/** Split screen: form on one side, brand panel on the other (panel hidden below lg). */
export default async function AuthLayout({ children }: { children: ReactNode }) {
  const t = await getTranslations("auth");
  return (
    <div className="bg-background text-foreground grid min-h-svh lg:grid-cols-2">
      <div className="flex flex-col gap-6 p-6 md:p-10">
        <div className="flex items-center justify-between gap-2">
          <Link href="/" className="text-lg font-bold tracking-tight">
            MakVid Studio
          </Link>
          <div className="flex items-center gap-2">
            <LocaleSwitcher />
            <ThemeToggle />
          </div>
        </div>
        <main id="main" className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-sm">{children}</div>
        </main>
      </div>
      <aside className="bg-primary text-primary-foreground relative hidden flex-col justify-center gap-6 p-12 lg:flex">
        <Clapperboard className="size-12" aria-hidden />
        <h2 className="text-3xl font-bold tracking-tight text-balance">{t("panelTitle")}</h2>
        <p className="max-w-md font-serif text-lg">{t("panelBody")}</p>
      </aside>
    </div>
  );
}
