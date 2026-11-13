import { defineTemplate } from "@makvid/style-kit";
import { scene3d } from "../../lib/scene3d";

export default defineTemplate({
  id: "list",
  build({ root, tl, enter, rng, duration, width, height }) {
    scene3d(root, tl, rng, duration, width, height, { count: 2, spin: 0.7 });
    enter("fadeUp", ".list-title", 0.05);
    const step = Math.min(0.45, (duration - 1.6) / 5);
    enter("pop", ".bullet", 0.45, { stagger: step, ease: "back.out", duration: 0.5 });
    enter("slideRight", ".item-text", 0.5, { stagger: step });
  },
});
