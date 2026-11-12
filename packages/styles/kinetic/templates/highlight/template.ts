import { defineTemplate } from "@makvid/style-kit";

export default defineTemplate({
  id: "highlight",
  build({ tl, qa }) {
    const words = qa(".hl-text .w");
    tl.fromTo(
      words,
      { opacity: 0, y: 50 },
      { opacity: 1, y: 0 },
      { duration: 0.35, ease: "back.out", stagger: 0.06 },
      0.1,
    );
    const em = qa(".hl-text .w.em");
    if (em.length)
      tl.fromTo(
        em,
        { y: 0 },
        { y: -14 },
        { duration: 0.25, ease: "power2.out", stagger: 0.05 },
        0.2 + words.length * 0.06,
      );
    if (em.length)
      tl.fromTo(
        em,
        { y: -14 },
        { y: 0 },
        { duration: 0.3, ease: "power2.inOut", stagger: 0.05 },
        0.45 + words.length * 0.06,
      );
  },
});
