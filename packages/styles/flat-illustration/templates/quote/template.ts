import { defineTemplate } from "@makvid/style-kit";

export default defineTemplate({
  id: "quote",
  build({ tl, enter }) {
    enter("pop", ".illus-bg", 0, { duration: 0.6, ease: "back.out" });
    enter("pop", ".illus-icon", 0.2, { duration: 0.5, ease: "back.out" });
    tl.fromTo(".illus-icon", { rotation: -6 }, { rotation: 6 }, { duration: 1.6, ease: "sine.inOut" }, 0.7);
    tl.fromTo(".illus-icon", { rotation: 6 }, { rotation: 0 }, { duration: 1.6, ease: "sine.inOut" }, 2.3);
    enter("pop", ".qmark", 0, { ease: "back.out" });
    enter("fadeUp", ".q-text .ln", 0.25, { stagger: 0.14 });
    enter("fadeIn", ".q-author", 1.1);
  },
});
