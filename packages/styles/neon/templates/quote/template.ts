import { defineTemplate } from "@makvid/style-kit";
import { flickerOn } from "../../lib/neon";

export default defineTemplate({
  id: "quote",
  build({ tl, enter, qa, rng }) {
    flickerOn(tl, rng, qa(".qmark"), 0);
    enter("fadeIn", ".q-text .ln", 0.3, { stagger: 0.16 });
    enter("fadeIn", ".q-author", 1.1);
  },
});
