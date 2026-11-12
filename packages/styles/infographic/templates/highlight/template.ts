import { defineTemplate } from "@makvid/style-kit";

export default defineTemplate({
  id: "highlight",
  build({ tl, enter, qa }) {
    enter("fadeIn", ".hl-text .w", 0.1, { stagger: 0.04, duration: 0.4 });
    const em = qa(".hl-text .w.em");
    if (em.length)
      tl.fromTo(em, { y: 0 }, { y: -8 }, { duration: 0.3, ease: "power2.out", stagger: 0.06 }, 1.1);
    if (em.length)
      tl.fromTo(em, { y: -8 }, { y: 0 }, { duration: 0.4, ease: "power2.inOut", stagger: 0.06 }, 1.4);
  },
});
