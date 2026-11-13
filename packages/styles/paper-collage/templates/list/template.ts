import { defineTemplate } from "@makvid/style-kit";
import { boil, pieces, stepIn } from "../../lib/collage";

export default defineTemplate({
  id: "list",
  build({ tl, qa, rng, duration }) {
    const title = pieces(rng, qa(".list-title .ln"), 1.5);
    stepIn(tl, title, 0.05, 0.2);
    const step = Math.min(0.5, (duration - 1.6) / 5);
    const items = pieces(rng, qa(".item"), 0, true); // full width: no tilt
    const end = stepIn(tl, items, 0.5, step, 0, 4);
    boil(tl, rng, [...title, ...items], end, duration);
  },
});
