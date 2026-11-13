import { defineTemplate } from "@makvid/style-kit";
import { scene3d } from "../../lib/scene3d";

export default defineTemplate({
  id: "cta",
  build({ root, tl, enter, rng, duration, width, height }) {
    scene3d(root, tl, rng, duration, width, height, { count: 4, spin: 1.2 });
    enter("rise", ".cta-head .ln", 0.1, { stagger: 0.1 });
    enter("pop", ".cta-btn", 0.75, { ease: "back.out" });
    tl.fromTo(".cta-btn", { scale: 1 }, { scale: 1.05 }, { duration: 0.45, ease: "sine.inOut" }, 1.5);
    tl.fromTo(".cta-btn", { scale: 1.05 }, { scale: 1 }, { duration: 0.45, ease: "sine.inOut" }, 1.95);
    enter("fadeIn", ".cta-handle", 1.1);
  },
});
