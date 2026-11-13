import { defineTemplate } from "@makvid/style-kit";
import { boil, pieces, stepIn } from "../../lib/collage";

export default defineTemplate({
  id: "quote",
  build({ tl, qa, rng, duration }) {
    const mark = pieces(rng, qa(".qmark"), 3);
    const card = pieces(rng, [...qa(".q-text"), ...qa(".q-author")], 0, true);
    const end = stepIn(tl, [...mark, ...card], 0.1, 0.4, -50, 4);
    boil(tl, rng, [...mark, ...card], end, duration);
  },
});
