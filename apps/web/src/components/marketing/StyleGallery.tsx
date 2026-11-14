import { getTranslations } from "next-intl/server";
import { Clapperboard } from "lucide-react";
import { styleCards, styleThumbnailFile } from "@/server/catalog";

/** Reads the real style packs; each card shows the thumbnail made for the style picker. */
export async function StyleGallery({ locale }: { locale: string }) {
  const t = await getTranslations("marketing.styles");
  const cards = styleCards(locale === "en" ? "en" : "vi");
  return (
    <section id="styles" className="bg-muted/50 scroll-mt-20 py-16">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <h2 className="text-3xl font-bold tracking-tight">{t("title")}</h2>
        <p className="text-muted-foreground mt-2 max-w-2xl font-serif">{t("subtitle")}</p>
        <ul className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {cards.map((s) => (
            <li key={s.id} className="bg-card overflow-hidden rounded-lg border">
              {styleThumbnailFile(s.id) ? (
                <img
                  src={`/api/styles/${s.id}/thumbnail`}
                  alt=""
                  loading="lazy"
                  width={270}
                  height={480}
                  className="aspect-[9/16] w-full object-cover"
                />
              ) : (
                <div className="from-primary/80 to-secondary/80 flex aspect-[9/16] w-full items-center justify-center bg-gradient-to-br">
                  <Clapperboard className="text-primary-foreground size-10" aria-hidden />
                </div>
              )}
              <div className="p-3">
                <p className="font-medium">{s.name}</p>
                <p className="text-muted-foreground line-clamp-2 text-xs">{s.description}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
