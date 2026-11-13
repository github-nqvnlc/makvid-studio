import { defineTemplate } from "@makvid/style-kit";
import { board, circle, draw, drive, stroke, underline, write } from "../../lib/board";

export default defineTemplate({
  id: "highlight",
  build({ root, tl, qa, rng, duration, width, height }) {
    const b = board(root, width, height);
    const words = qa(".hl-text .w");
    const per = Math.min(0.2, (duration * 0.45) / Math.max(1, words.length));
    const end = write(tl, b, words, 0.15, per);
    const em = qa(".hl-text .w.em");
    if (em.length === 1) {
      // One word: circle it.
      draw(tl, stroke(em[0]!, "wb-circle", circle(rng)), end + 0.2, 0.5);
    } else {
      // A phrase: one marker underline running word to word (each segment also spans the following space).
      const seg = Math.min(0.25, 0.9 / em.length);
      em.forEach((w, i) => {
        const host = w.ownerDocument.createElement("span");
        host.className = i < em.length - 1 ? "wb-em-ul wb-em-ul-join" : "wb-em-ul";
        w.appendChild(host);
        draw(tl, stroke(host, "wb-ul", underline(rng)), end + 0.2 + i * seg, seg);
      });
    }
    drive(tl, b, duration);
  },
});
