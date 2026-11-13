import { defineTemplate } from "@makvid/style-kit";
import { board, drive, write } from "../../lib/board";

export default defineTemplate({
  id: "quote",
  build({ root, tl, enter, qa, duration, width, height }) {
    const b = board(root, width, height);
    enter("fadeIn", ".qmark", 0);
    const words = qa(".q-text .w");
    const per = Math.min(0.18, (duration * 0.45) / Math.max(1, words.length));
    const end = write(tl, b, words, 0.25, per);
    enter("fadeIn", ".q-author", end + 0.1);
    drive(tl, b, duration);
  },
});
