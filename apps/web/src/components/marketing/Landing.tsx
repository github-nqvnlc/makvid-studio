import { Hero } from "./Hero";
import { Faq, Features, FinalCta, HowItWorks, UseCases } from "./Sections";
import { StyleGallery } from "./StyleGallery";

/** The nine blocks of the guest home page (spec FR-013). */
export function Landing({ locale }: { locale: string }) {
  return (
    <>
      <Hero locale={locale} />
      <HowItWorks />
      <StyleGallery locale={locale} />
      <Features />
      <UseCases />
      <Faq />
      <FinalCta />
    </>
  );
}
