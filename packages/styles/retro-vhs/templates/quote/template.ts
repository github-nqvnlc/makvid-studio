import { defineTemplate } from "@makvid/style-kit";
import { vhs } from "../../lib/vhs";

export default defineTemplate({
  id: "quote",
  build({ root, tl, enter, rng, duration, height }) {
    vhs(root, tl, rng, duration, height);
    enter("fadeIn", ".qmark", 0.05, { duration: 0.1 });
    enter("fadeIn", ".q-text .ln", 0.3, { duration: 0.12, stagger: 0.2 });
    enter("fadeIn", ".q-author", 1.2, { duration: 0.2 });
  },
});
