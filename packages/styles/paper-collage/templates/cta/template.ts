import { defineTemplate } from "@makvid/style-kit";
import { boil, pieces, stepIn } from "../../lib/collage";

export default defineTemplate({
  id: "cta",
  build({ tl, qa, rng, duration }) {
    const ps = pieces(rng, [...qa(".cta-head .ln"), ...qa(".cta-btn"), ...qa(".cta-handle")], 2);
    const end = stepIn(tl, ps, 0.1, 0.28);
    boil(tl, rng, ps, end, duration);
  },
});
