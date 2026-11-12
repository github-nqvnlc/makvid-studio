import { defineTemplate } from "@makvid/style-kit";

export default defineTemplate({
  id: "highlight",
  build({ enter, qa }) {
    enter("fadeUp", ".hl-text .w", 0.1, { stagger: 0.035, duration: 0.5 });
    const em = qa(".hl-text .w.em");
    if (em.length) enter("pop", em, 1.0, { stagger: 0.08, ease: "back.out", duration: 0.5 });
  },
});
