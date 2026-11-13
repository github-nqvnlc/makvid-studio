import { defineTemplate } from "@makvid/style-kit";
import { vhs } from "../../lib/vhs";

export default defineTemplate({
  id: "list",
  build({ root, tl, enter, rng, duration, height }) {
    vhs(root, tl, rng, duration, height);
    enter("fadeIn", ".list-title", 0.1, { duration: 0.15 });
    const step = Math.min(0.45, (duration - 1.6) / 5);
    enter("fadeIn", ".item", 0.5, { duration: 0.08, stagger: step });
  },
});
