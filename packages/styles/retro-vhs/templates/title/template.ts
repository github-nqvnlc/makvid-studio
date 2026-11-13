import { defineTemplate } from "@makvid/style-kit";
import { vhs, wobble } from "../../lib/vhs";

export default defineTemplate({
  id: "title",
  build({ root, tl, enter, qa, rng, duration, height }) {
    vhs(root, tl, rng, duration, height);
    enter("fadeIn", ".title-text .ln", 0.2, { duration: 0.12, stagger: 0.18 });
    enter("fadeIn", ".subtitle", 0.8, { duration: 0.2 });
    wobble(tl, rng, qa, ".title-text .ln", duration);
  },
});
