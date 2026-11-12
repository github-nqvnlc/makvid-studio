import { defineTemplate } from "@makvid/style-kit";

export default defineTemplate({
  id: "highlight",
  build({ tl, enter, qa }) {
    tl.fromTo(".sh-bar", { scaleX: 0 }, { scaleX: 1 }, { duration: 0.6, ease: "power3.out" }, 0);
    enter("fadeIn", ".sh-dots i", 0.1, { stagger: 0.08, duration: 0.3 });
    enter("fadeIn", ".hl-text .w", 0.1, { stagger: 0.03, duration: 0.4 });
    const em = qa(".hl-text .w.em");
    if (em.length) enter("pop", em, 0.9, { stagger: 0.08, ease: "back.out", duration: 0.45 });
  },
});
