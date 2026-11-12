import { defineTemplate } from "@makvid/style-kit";

export default defineTemplate({
  id: "list",
  build({ tl, enter, duration }) {
    enter("pop", ".illus-bg", 0, { duration: 0.6, ease: "back.out" });
    enter("pop", ".illus-icon", 0.2, { duration: 0.5, ease: "back.out" });
    tl.fromTo(".illus-icon", { rotation: -6 }, { rotation: 6 }, { duration: 1.6, ease: "sine.inOut" }, 0.7);
    tl.fromTo(".illus-icon", { rotation: 6 }, { rotation: 0 }, { duration: 1.6, ease: "sine.inOut" }, 2.3);
    enter("fadeUp", ".list-title", 0.05);
    const step = Math.min(0.45, (duration - 1.6) / 5);
    enter("pop", ".bullet", 0.45, { stagger: step, ease: "back.out", duration: 0.5 });
    enter("slideRight", ".item-text", 0.5, { stagger: step });
  },
});
