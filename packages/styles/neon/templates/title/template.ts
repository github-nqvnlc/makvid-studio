import { defineTemplate } from "@makvid/style-kit";
import { flickerOn, glitch, hum } from "../../lib/neon";

export default defineTemplate({
  id: "title",
  build({ enter, tl, qa, rng, duration }) {
    flickerOn(tl, rng, qa(".deco"), 0);
    hum(tl, qa(".deco"), duration);
    flickerOn(tl, rng, qa(".title-text .ln"), 0.2);
    enter("fadeUp", ".subtitle", 0.8);
    glitch(tl, rng, qa, ".title-text .ln", duration);
  },
});
