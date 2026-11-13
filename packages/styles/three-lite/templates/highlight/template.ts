import { defineTemplate } from "@makvid/style-kit";
import { scene3d } from "../../lib/scene3d";

export default defineTemplate({
  id: "highlight",
  build({ root, tl, enter, qa, rng, duration, width, height }) {
    scene3d(root, tl, rng, duration, width, height, { count: 3, spin: 0.8 });
    enter("fadeUp", ".hl-text .w", 0.1, { stagger: 0.04 });
    const em = qa(".hl-text .w.em");
    if (em.length) enter("pop", em, 0.9, { stagger: 0.08, ease: "back.out" });
  },
});
