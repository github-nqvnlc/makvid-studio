import { defineTemplate } from "@makvid/style-kit";
import { circle, draw, stroke, underline } from "../../lib/board";

export default defineTemplate({
  id: "list",
  build({ tl, enter, q, qa, rng, duration }) {
    enter("fadeIn", ".list-title", 0.05);
    const title = q(".list-title");
    if (title) {
      const host = title.ownerDocument.createElement("span");
      host.className = "wb-title-ul";
      title.appendChild(host);
      draw(tl, stroke(host, "wb-ul", underline(rng)), 0.35, 0.4);
    }
    const step = Math.min(0.45, (duration - 1.6) / 5);
    qa(".bullet").forEach((bl, i) => draw(tl, stroke(bl, "wb-circle", circle(rng)), 0.5 + i * step, 0.35));
    enter("fadeIn", ".bullet", 0.5, { stagger: step, duration: 0.2 });
    enter("slideRight", ".item-text", 0.6, { stagger: step, distance: 12 });
  },
});
