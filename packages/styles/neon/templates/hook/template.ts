import { defineTemplate } from "@makvid/style-kit";
import { flickerOn, glitch, hum } from "../../lib/neon";

export default defineTemplate({
  id: "hook",
  build({ tl, enter, qa, rng, duration }) {
    flickerOn(tl, rng, qa(".deco"), 0);
    hum(tl, qa(".deco"), duration);
    enter("fadeIn", ".kicker", 0.15);
    flickerOn(tl, rng, qa(".headline .ln"), 0.3);
    tl.fromTo(".rule", { scaleX: 0 }, { scaleX: 1 }, { duration: 0.5, ease: "power3.out" }, 0.8);
    glitch(tl, rng, qa, ".headline .ln", duration);
  },
});
