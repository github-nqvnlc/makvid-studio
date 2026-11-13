import { defineTemplate } from "@makvid/style-kit";
import { boil, pieces, stepIn } from "../../lib/collage";

export default defineTemplate({
  id: "compare",
  build({ tl, qa, rng, duration }) {
    stepIn(tl, pieces(rng, qa(".cmp-title .ln"), 1), 0.05, 0.2);
    const cards = pieces(rng, qa(".card"), 0, true); // cards fill the region: no tilt
    const end = stepIn(tl, cards, 0.4, 0.5, -80, 4);
    boil(tl, rng, cards, end, duration);
  },
});
