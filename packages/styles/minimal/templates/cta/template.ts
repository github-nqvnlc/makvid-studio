import { defineTemplate } from "@makvid/style-kit";

export default defineTemplate({
  id: "cta",
  build({ tl, enter }) {
    enter("fadeIn", ".deco", 0, { duration: 1.2, ease: "sine.out" });
    enter("fadeUp", ".cta-head .w", 0.1, { stagger: 0.05 });
    enter("pop", ".cta-btn", 0.8, { ease: "back.out" });
    tl.fromTo(".cta-btn", { scale: 1 }, { scale: 1.04 }, { duration: 0.6, ease: "sine.inOut" }, 1.8);
    tl.fromTo(".cta-btn", { scale: 1.04 }, { scale: 1 }, { duration: 0.6, ease: "sine.inOut" }, 2.4);
    enter("fadeIn", ".cta-handle", 1.1);
  },
});
