import { defineTemplate } from "@makvid/style-kit";
import { vhs } from "../../lib/vhs";

export default defineTemplate({
  id: "compare",
  build({ root, tl, enter, rng, duration, height }) {
    vhs(root, tl, rng, duration, height);
    enter("fadeIn", ".cmp-title", 0.1, { duration: 0.15 });
    enter("slideRight", ".card.left", 0.35, { duration: 0.3 });
    enter("slideLeft", ".card.right", 0.8, { duration: 0.3 });
    enter("fadeIn", ".ci", 1.1, { duration: 0.05, stagger: 0.12 });
  },
});
