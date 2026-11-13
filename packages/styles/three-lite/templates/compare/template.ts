import { defineTemplate } from "@makvid/style-kit";
import { scene3d } from "../../lib/scene3d";

export default defineTemplate({
  id: "compare",
  build({ root, tl, enter, rng, duration, width, height }) {
    scene3d(root, tl, rng, duration, width, height, { count: 2, spin: 0.7 });
    enter("fadeUp", ".cmp-title", 0.05);
    enter("slideRight", ".card.left", 0.35);
    enter("slideLeft", ".card.right", 0.75);
    enter("fadeIn", ".ci", 1.1, { stagger: 0.1 });
  },
});
