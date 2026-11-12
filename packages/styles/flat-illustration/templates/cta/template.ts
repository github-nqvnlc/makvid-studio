import { defineTemplate } from "@makvid/style-kit";

export default defineTemplate({
  id: "cta",
  build({ tl, enter }) {
    enter("pop", ".illus-bg", 0, { duration: 0.6, ease: "back.out" });
    enter("pop", ".illus-icon", 0.2, { duration: 0.5, ease: "back.out" });
    tl.fromTo(".illus-icon", { rotation: -6 }, { rotation: 6 }, { duration: 1.6, ease: "sine.inOut" }, 0.7);
    tl.fromTo(".illus-icon", { rotation: 6 }, { rotation: 0 }, { duration: 1.6, ease: "sine.inOut" }, 2.3);
    enter("pop", ".cta-head .w", 0.1, { stagger: 0.05, ease: "back.out" });
    enter("pop", ".cta-btn", 0.8, { ease: "back.out" });
    tl.fromTo(".cta-btn", { y: 0 }, { y: -8 }, { duration: 0.4, ease: "sine.inOut" }, 1.6);
    tl.fromTo(".cta-btn", { y: -8 }, { y: 0 }, { duration: 0.4, ease: "sine.inOut" }, 2.0);
    enter("fadeIn", ".cta-handle", 1.1);
  },
});
