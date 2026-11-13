import { defineTemplate } from "@makvid/style-kit";
import { vhs, wobble } from "../../lib/vhs";

export default defineTemplate({
  id: "highlight",
  build({ root, tl, enter, qa, rng, duration, height }) {
    vhs(root, tl, rng, duration, height);
    // Words appear one by one like an old caption generator.
    enter("fadeIn", ".hl-text .w", 0.15, { duration: 0.01, stagger: 0.07 });
    wobble(tl, rng, qa, ".hl-text .ln", duration);
  },
});
