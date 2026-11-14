import {
  BarChart3,
  Briefcase,
  GraduationCap,
  KeyRound,
  Languages,
  MessageSquare,
  Palette,
  Captions,
  PenLine,
  ShoppingBag,
  Users,
  Wand2,
  Download,
  type LucideIcon,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function IconBadge({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <span className="bg-accent text-accent-foreground flex size-10 items-center justify-center rounded-full">
      <Icon className="size-5" aria-hidden />
    </span>
  );
}

export async function HowItWorks() {
  const t = await getTranslations("marketing.steps");
  const steps: Array<[LucideIcon, "s1" | "s2" | "s3"]> = [
    [PenLine, "s1"],
    [Wand2, "s2"],
    [Download, "s3"],
  ];
  return (
    <section className="mx-auto max-w-6xl px-4 py-16 md:px-6">
      <h2 className="text-3xl font-bold tracking-tight">{t("title")}</h2>
      <ol className="mt-8 grid gap-4 md:grid-cols-3">
        {steps.map(([icon, k], i) => (
          <li key={k} className="bg-card flex flex-col gap-3 rounded-lg border p-5">
            <div className="flex items-center gap-3">
              <IconBadge icon={icon} />
              <span className="text-muted-foreground font-mono text-sm">{i + 1}</span>
            </div>
            <h3 className="font-semibold">{t(`${k}.title`)}</h3>
            <p className="text-muted-foreground text-sm">{t(`${k}.body`)}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

export async function Features() {
  const t = await getTranslations("marketing.features");
  const items: Array<[LucideIcon, "f1" | "f2" | "f3" | "f4" | "f5" | "f6"]> = [
    [Languages, "f1"],
    [Captions, "f2"],
    [MessageSquare, "f3"],
    [Palette, "f4"],
    [KeyRound, "f5"],
    [Users, "f6"],
  ];
  return (
    <section id="features" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16 md:px-6">
      <h2 className="text-3xl font-bold tracking-tight">{t("title")}</h2>
      <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map(([icon, k]) => (
          <li key={k} className="bg-card flex flex-col gap-3 rounded-lg border p-5">
            <IconBadge icon={icon} />
            <h3 className="font-semibold">{t(`${k}.title`)}</h3>
            <p className="text-muted-foreground text-sm">{t(`${k}.body`)}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

export async function UseCases() {
  const t = await getTranslations("marketing.useCases");
  const items: Array<[LucideIcon, "u1" | "u2" | "u3" | "u4"]> = [
    [ShoppingBag, "u1"],
    [BarChart3, "u2"],
    [GraduationCap, "u3"],
    [Briefcase, "u4"],
  ];
  return (
    <section className="bg-muted/50 py-16">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <h2 className="text-3xl font-bold tracking-tight">{t("title")}</h2>
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {items.map(([icon, k]) => (
            <li key={k} className="bg-card flex flex-col gap-3 rounded-lg border p-5">
              <IconBadge icon={icon} />
              <h3 className="font-semibold">{t(`${k}.title`)}</h3>
              <p className="text-muted-foreground text-sm">{t(`${k}.body`)}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export async function Faq() {
  const t = await getTranslations("marketing.faq");
  const keys = ["q1", "q2", "q3", "q4", "q5"] as const;
  return (
    <section className="mx-auto max-w-3xl px-4 py-16 md:px-6">
      <h2 className="text-3xl font-bold tracking-tight">{t("title")}</h2>
      <Accordion type="single" collapsible className="mt-6">
        {keys.map((k) => (
          <AccordionItem key={k} value={k}>
            <AccordionTrigger>{t(`${k}.q`)}</AccordionTrigger>
            <AccordionContent className="text-muted-foreground">{t(`${k}.a`)}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
}

export async function FinalCta() {
  const t = await getTranslations("marketing.cta");
  return (
    <section className="px-4 pb-16 md:px-6">
      <div className="bg-primary text-primary-foreground mx-auto flex max-w-6xl flex-col items-center gap-4 rounded-2xl p-10 text-center">
        <h2 className="text-3xl font-bold tracking-tight">{t("title")}</h2>
        <p className="font-serif">{t("body")}</p>
        <Link href="/sign-up" className={cn(buttonVariants({ size: "lg", variant: "secondary" }))}>
          {t("button")}
        </Link>
      </div>
    </section>
  );
}
