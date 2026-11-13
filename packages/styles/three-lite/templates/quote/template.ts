import { defineTemplate } from "@makvid/style-kit";
import { scene3d } from "../../lib/scene3d";

export default defineTemplate({
  id: "quote",
  build({ root, tl, enter, rng, duration, width, height }) {
    scene3d(root, tl, rng, duration, width, height, { count: 3, spin: 0.6 });
    enter("pop", ".qmark", 0, { ease: "back.out" });
    enter("fadeUp", ".q-text .ln", 0.25, { stagger: 0.14 });
    enter("fadeIn", ".q-author", 1.1);
  },
});
