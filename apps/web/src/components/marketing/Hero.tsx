import { existsSync } from "node:fs";
import { join } from "node:path";
import { Film, Play } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DemoVideo } from "./DemoVideo";

/** The demo files are optional: without them the hero shows a drawn 9:16 frame instead of a broken player. */
function demoFiles(locale: string) {
  const dir = join(process.cwd(), "public", "demo");
  const video = `hero.${locale}.mp4`;
  const poster = `hero.${locale}.webp`;
  return {
    video: existsSync(join(dir, video)) ? `/demo/${video}` : null,
    poster: existsSync(join(dir, poster)) ? `/demo/${poster}` : null,
  };
}

export async function Hero({ locale }: { locale: string }) {
  const t = await getTranslations("marketing.hero");
  const demo = demoFiles(locale);
  return (
    <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-12 md:grid-cols-2 md:px-6 md:py-20">
      <div className="flex flex-col items-start gap-5">
        <span className="bg-accent text-accent-foreground inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium">
          <Film className="size-3.5" aria-hidden />
          {t("badge")}
        </span>
        <h1 className="text-4xl font-bold tracking-tight text-balance md:text-5xl">{t("title")}</h1>
        <p className="text-muted-foreground font-serif text-lg">{t("subtitle")}</p>
        <div className="flex flex-wrap gap-3">
          <Link href="/sign-up" className={cn(buttonVariants({ size: "lg" }))}>
            {t("cta")}
          </Link>
          <Link href="/pricing" className={cn(buttonVariants({ size: "lg", variant: "outline" }))}>
            {t("ctaSecondary")}
          </Link>
        </div>
        <p className="text-muted-foreground text-sm">{t("note")}</p>
      </div>
      <div className="mx-auto w-full max-w-[280px]">
        <div className="border-foreground bg-card relative aspect-[9/16] overflow-hidden rounded-3xl border-2 shadow-lg">
          {demo.video ? (
            <DemoVideo src={demo.video} poster={demo.poster} label={t("demoLabel")} />
          ) : (
            <div
              role="img"
              aria-label={t("demoPlaceholder")}
              className="from-primary to-secondary flex size-full items-center justify-center bg-gradient-to-br"
            >
              <Play className="text-primary-foreground size-14" aria-hidden />
            </div>
          )}
        </div>
        <p className="text-muted-foreground mt-3 text-center text-xs">{t("demoLabel")}</p>
      </div>
    </section>
  );
}
