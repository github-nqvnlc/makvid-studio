import { defineTemplate } from "@makvid/style-kit";
import { board, sketchBox, draw, drive, stroke, write } from "../../lib/board";

export default defineTemplate({
  id: "cta",
  build({ root, tl, enter, q, qa, rng, duration, width, height }) {
    const b = board(root, width, height);
    const words = qa(".cta-head .w");
    const per = Math.min(0.2, (duration * 0.35) / Math.max(1, words.length));
    const end = write(tl, b, words, 0.15, per);
    const btn = q(".cta-btn");
    if (btn) draw(tl, stroke(btn, "wb-box", sketchBox(rng)), end + 0.1, 0.6);
    enter("fadeIn", ".cta-btn .fit", end + 0.3);
    enter("fadeIn", ".cta-handle", end + 0.6);
    drive(tl, b, duration);
  },
});
