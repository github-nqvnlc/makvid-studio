import { defineTemplate } from "@makvid/style-kit";
import { vhs, wobble } from "../../lib/vhs";

export default defineTemplate({
  id: "hook",
  build({ root, tl, enter, qa, rng, duration, height }) {
    vhs(root, tl, rng, duration, height);
    enter("fadeIn", ".kicker", 0.2, { duration: 0.15 });
    enter("fadeIn", ".headline .ln", 0.35, { duration: 0.12, stagger: 0.18 });
    tl.fromTo(".rule", { scaleX: 0 }, { scaleX: 1 }, { duration: 0.4, ease: "none" }, 0.9);
    wobble(tl, rng, qa, ".headline .ln", duration);
  },
});
