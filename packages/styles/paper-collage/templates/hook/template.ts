import { defineTemplate } from "@makvid/style-kit";
import { boil, pieces, stepIn } from "../../lib/collage";

export default defineTemplate({
  id: "hook",
  build({ tl, qa, rng, duration }) {
    const ps = pieces(rng, [...qa(".kicker"), ...qa(".headline .ln"), ...qa(".rule")], 2);
    const end = stepIn(tl, ps, 0.1, 0.3);
    boil(tl, rng, ps, end, duration);
  },
});
