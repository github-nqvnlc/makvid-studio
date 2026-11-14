"use client";
import { useState } from "react";
import { Menu } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button, buttonVariants } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { LocaleSwitcher } from "@/components/common/LocaleSwitcher";
import { ThemeToggle } from "@/components/common/ThemeToggle";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/#features", key: "features" },
  { href: "/#styles", key: "styles" },
  { href: "/pricing", key: "pricing" },
  { href: "/docs/api", key: "docs" },
] as const;

export function PublicHeader({ signedIn }: { signedIn: boolean }) {
  const t = useTranslations("marketing.nav");
  const [open, setOpen] = useState(false);
  return (
    <header className="bg-background/90 supports-[backdrop-filter]:bg-background/70 sticky top-0 z-40 border-b backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 md:px-6">
        <Link href="/" className="text-lg font-bold tracking-tight">
          MakVid Studio
        </Link>
        <nav aria-label={t("menu")} className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) => (
            <Link key={l.key} href={l.href} className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
              {t(l.key)}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <LocaleSwitcher signedIn={signedIn} />
          <ThemeToggle />
          <div className="hidden items-center gap-2 md:flex">
            {signedIn ? (
              <Link href="/" className={cn(buttonVariants({ size: "sm" }))}>
                {t("openApp")}
              </Link>
            ) : (
              <>
                <Link href="/sign-in" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
                  {t("signIn")}
                </Link>
                <Link href="/sign-up" className={cn(buttonVariants({ size: "sm" }))}>
                  {t("startFree")}
                </Link>
              </>
            )}
          </div>
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="md:hidden" aria-label={t("menu")} data-testid="mobile-menu">
                <Menu className="size-5" aria-hidden />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72">
              <SheetHeader>
                <SheetTitle>MakVid Studio</SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col gap-1 px-4" onClick={() => setOpen(false)}>
                {LINKS.map((l) => (
                  <Link key={l.key} href={l.href} className={cn(buttonVariants({ variant: "ghost" }), "justify-start")}>
                    {t(l.key)}
                  </Link>
                ))}
                {signedIn ? (
                  <Link href="/" className={cn(buttonVariants(), "mt-2")}>
                    {t("openApp")}
                  </Link>
                ) : (
                  <>
                    <Link href="/sign-in" className={cn(buttonVariants({ variant: "outline" }), "mt-2")}>
                      {t("signIn")}
                    </Link>
                    <Link href="/sign-up" className={cn(buttonVariants())}>
                      {t("startFree")}
                    </Link>
                  </>
                )}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
