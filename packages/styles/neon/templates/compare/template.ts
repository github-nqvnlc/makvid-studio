import { defineTemplate } from "@makvid/style-kit";
import { flickerOn } from "../../lib/neon";

export default defineTemplate({
  id: "compare",
  build({ tl, enter, qa, rng }) {
    flickerOn(tl, rng, qa(".cmp-title .ln"), 0.05);
    enter("fadeUp", ".card.left", 0.35);
    flickerOn(tl, rng, qa(".card.right"), 0.85);
    enter("fadeIn", ".ci", 1.2, { stagger: 0.1 });
  },
});
