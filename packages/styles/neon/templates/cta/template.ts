import { defineTemplate } from "@makvid/style-kit";
import { flickerOn, glitch, hum } from "../../lib/neon";

export default defineTemplate({
  id: "cta",
  build({ tl, enter, qa, rng, duration }) {
    flickerOn(tl, rng, qa(".deco"), 0);
    hum(tl, qa(".deco"), duration);
    flickerOn(tl, rng, qa(".cta-head .ln"), 0.15);
    flickerOn(tl, rng, qa(".cta-btn"), 0.75);
    tl.fromTo(".cta-btn", { scale: 1 }, { scale: 1.04 }, { duration: 0.5, ease: "sine.inOut" }, 1.4);
    tl.fromTo(".cta-btn", { scale: 1.04 }, { scale: 1 }, { duration: 0.5, ease: "sine.inOut" }, 1.9);
    enter("fadeIn", ".cta-handle", 1.1);
    glitch(tl, rng, qa, ".cta-head .ln", duration);
  },
});
