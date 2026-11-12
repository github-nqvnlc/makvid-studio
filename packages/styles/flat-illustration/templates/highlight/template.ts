import { defineTemplate } from "@makvid/style-kit";

export default defineTemplate({
  id: "highlight",
  build({ tl, enter, qa }) {
    enter("pop", ".illus-bg", 0, { duration: 0.6, ease: "back.out" });
    enter("pop", ".illus-icon", 0.2, { duration: 0.5, ease: "back.out" });
    tl.fromTo(".illus-icon", { rotation: -6 }, { rotation: 6 }, { duration: 1.6, ease: "sine.inOut" }, 0.7);
    tl.fromTo(".illus-icon", { rotation: 6 }, { rotation: 0 }, { duration: 1.6, ease: "sine.inOut" }, 2.3);
    enter("fadeUp", ".hl-text .w", 0.1, { stagger: 0.035 });
    const em = qa(".hl-text .w.em");
    if (em.length) enter("pop", em, 0.9, { stagger: 0.08, ease: "back.out" });
  },
});
