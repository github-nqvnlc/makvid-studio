import { defineTemplate } from "@makvid/style-kit";
import { board, drive, write } from "../../lib/board";

export default defineTemplate({
  id: "title",
  build({ root, tl, qa, duration, width, height }) {
    const b = board(root, width, height);
    const words = qa(".title-text .w");
    const per = Math.min(0.22, (duration * 0.4) / Math.max(1, words.length));
    const end = write(tl, b, words, 0.2, per);
    const sub = qa(".subtitle .w");
    write(tl, b, sub, end + 0.1, Math.min(0.12, (duration * 0.25) / Math.max(1, sub.length)));
    drive(tl, b, duration);
  },
});
