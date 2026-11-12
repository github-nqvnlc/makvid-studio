import { defineTemplate } from "@makvid/style-kit";

export default defineTemplate({
  id: "cta",
  build({ tl, enter }) {
    tl.fromTo(
      ".deco",
      { opacity: 0, rotation: -120 },
      { opacity: 1, rotation: 0 },
      { duration: 1.4, ease: "power3.out" },
      0,
    );
    enter("fadeUp", ".cta-head .w", 0.1, { stagger: 0.05 });
    enter("pop", ".cta-btn", 0.8, { ease: "back.out" });
    enter("fadeIn", ".cta-handle", 1.1);
  },
});
