import { defineTemplate } from "@makvid/style-kit";
import { flickerOn, glitch } from "../../lib/neon";

export default defineTemplate({
  id: "highlight",
  build({ tl, enter, qa, rng, duration }) {
    enter("fadeIn", ".hl-text .w", 0.1, { stagger: 0.04 });
    const em = qa(".hl-text .w.em");
    if (em.length) flickerOn(tl, rng, em, 1.0);
    glitch(tl, rng, qa, ".hl-text .ln", duration);
  },
});
