import { defineTemplate } from "@makvid/style-kit";

export default defineTemplate({
  id: "title",
  build({ tl, enter }) {
    enter("pop", ".illus-bg", 0, { duration: 0.6, ease: "back.out" });
    enter("pop", ".illus-icon", 0.2, { duration: 0.5, ease: "back.out" });
    tl.fromTo(".illus-icon", { rotation: -6 }, { rotation: 6 }, { duration: 1.6, ease: "sine.inOut" }, 0.7);
    tl.fromTo(".illus-icon", { rotation: 6 }, { rotation: 0 }, { duration: 1.6, ease: "sine.inOut" }, 2.3);
    enter("rise", ".title-text .ln", 0.15, { stagger: 0.12 });
    enter("fadeUp", ".subtitle", 0.7);
  },
});
