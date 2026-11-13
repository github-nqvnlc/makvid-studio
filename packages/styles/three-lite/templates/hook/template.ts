import { defineTemplate } from "@makvid/style-kit";
import { scene3d } from "../../lib/scene3d";

export default defineTemplate({
  id: "hook",
  build({ root, tl, enter, rng, duration, width, height }) {
    scene3d(root, tl, rng, duration, width, height, { count: 4 });
    enter("fadeUp", ".kicker", 0.15);
    enter("rise", ".headline .ln", 0.3, { stagger: 0.12 });
    tl.fromTo(".rule", { scaleX: 0 }, { scaleX: 1 }, { duration: 0.7, ease: "expo.out" }, 0.8);
  },
});
