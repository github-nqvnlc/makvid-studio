import { defineTemplate } from "@makvid/style-kit";
import { boil, pieces, stepIn } from "../../lib/collage";

export default defineTemplate({
  id: "title",
  build({ tl, qa, rng, duration }) {
    const lines = pieces(rng, qa(".title-text .ln"), 2);
    const end = stepIn(tl, lines, 0.1, 0.3);
    stepIn(tl, pieces(rng, qa(".subtitle"), 0, true), end - 0.2, 0, 30, 3);
    boil(tl, rng, lines, end, duration);
  },
});
