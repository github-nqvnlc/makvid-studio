import { defineTemplate } from "@makvid/style-kit";
import { board, draw, drive, stroke, underline, write } from "../../lib/board";

export default defineTemplate({
  id: "hook",
  build({ root, tl, enter, q, qa, rng, duration, width, height }) {
    const b = board(root, width, height);
    enter("fadeIn", ".kicker", 0.1);
    const words = qa(".headline .w");
    const per = Math.min(0.22, (duration * 0.45) / Math.max(1, words.length));
    const end = write(tl, b, words, 0.3, per);
    const rule = q(".rule");
    if (rule) draw(tl, stroke(rule, "wb-ul", underline(rng)), end, 0.5);
    drive(tl, b, duration);
  },
});
