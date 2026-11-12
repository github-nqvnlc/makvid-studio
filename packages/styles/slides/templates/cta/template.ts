import { defineTemplate } from "@makvid/style-kit";

export default defineTemplate({
  id: "cta",
  build({ tl, enter }) {
    tl.fromTo(".sh-bar", { scaleX: 0 }, { scaleX: 1 }, { duration: 0.6, ease: "power3.out" }, 0);
    enter("fadeIn", ".sh-dots i", 0.1, { stagger: 0.08, duration: 0.3 });
    enter("fadeUp", ".cta-head .ln", 0.1, { stagger: 0.12 });
    enter("pop", ".cta-btn", 0.7, { ease: "back.out" });
    enter("fadeIn", ".cta-handle", 1.0);
  },
});
