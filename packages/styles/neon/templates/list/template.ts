import { defineTemplate } from "@makvid/style-kit";
import { flickerOn } from "../../lib/neon";

export default defineTemplate({
  id: "list",
  build({ tl, enter, qa, rng, duration }) {
    flickerOn(tl, rng, qa(".list-title .ln"), 0.05);
    const step = Math.min(0.45, (duration - 1.6) / 5);
    qa(".bullet").forEach((b, i) => flickerOn(tl, rng, [b], 0.5 + i * step));
    enter("slideRight", ".item-text", 0.55, { stagger: step });
  },
});
