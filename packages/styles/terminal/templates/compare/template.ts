import { defineTemplate } from "@makvid/style-kit";
import { typeText, highlightSyntax } from "../../lib/term";

export default defineTemplate({
  id: "compare",
  build({ tl, enter, qa }) {
    highlightSyntax(qa);
    enter("fadeDown", ".term-bar", 0, { duration: 0.35 });
    const end = typeText(tl, qa, ".cmp-title", 0.25, 0.03);
    enter("fadeIn", ".card.left", end + 0.1, { duration: 0.3 });
    enter("fadeIn", ".card.left .ci", end + 0.3, { stagger: 0.2, duration: 0.2 });
    enter("fadeIn", ".card.right", end + 0.9, { duration: 0.3 });
    enter("fadeIn", ".card.right .ci", end + 1.1, { stagger: 0.2, duration: 0.2 });
  },
});
