import { defineTemplate } from "@makvid/style-kit";
import { board, circle, draw, drive, stroke, write } from "../../lib/board";

export default defineTemplate({
  id: "highlight",
  build({ root, tl, qa, rng, duration, width, height }) {
    const b = board(root, width, height);
    const words = qa(".hl-text .w");
    const per = Math.min(0.2, (duration * 0.45) / Math.max(1, words.length));
    const end = write(tl, b, words, 0.15, per);
    qa(".hl-text .w.em").forEach((w, i) =>
      draw(tl, stroke(w, "wb-circle", circle(rng)), end + 0.2 + i * 0.35, 0.5),
    );
    drive(tl, b, duration);
  },
});
