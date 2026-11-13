import { defineTemplate } from "@makvid/style-kit";
import { vhs, wobble } from "../../lib/vhs";

export default defineTemplate({
  id: "cta",
  build({ root, tl, enter, qa, rng, duration, height }) {
    vhs(root, tl, rng, duration, height);
    enter("fadeIn", ".cta-head .ln", 0.15, { duration: 0.12, stagger: 0.18 });
    enter("fadeIn", ".cta-btn", 0.8, { duration: 0.1 });
    // Blinking button, three times.
    for (let i = 0; i < 3; i++) {
      tl.set(".cta-btn", { opacity: 0.25 }, 1.4 + i * 0.5);
      tl.set(".cta-btn", { opacity: 1 }, 1.65 + i * 0.5);
    }
    enter("fadeIn", ".cta-handle", 1.1, { duration: 0.2 });
    wobble(tl, rng, qa, ".cta-head .ln", duration);
  },
});
