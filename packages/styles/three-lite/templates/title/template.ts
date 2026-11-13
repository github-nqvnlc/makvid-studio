import { defineTemplate } from "@makvid/style-kit";
import { scene3d } from "../../lib/scene3d";

export default defineTemplate({
  id: "title",
  build({ root, tl, enter, rng, duration, width, height }) {
    scene3d(root, tl, rng, duration, width, height, { count: 4 });
    enter("zoomOut", ".title-text .ln", 0.2, { stagger: 0.12 });
    enter("fadeUp", ".subtitle", 0.75);
  },
});
