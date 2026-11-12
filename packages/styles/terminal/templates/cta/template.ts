import { defineTemplate } from "@makvid/style-kit";
import { typeText, highlightSyntax, cursor } from "../../lib/term";

export default defineTemplate({
  id: "cta",
  build({ tl, enter, q, qa, duration }) {
    highlightSyntax(qa);
    enter("fadeDown", ".term-bar", 0, { duration: 0.35 });
    const end = typeText(tl, qa, ".cta-head", 0.25, 0.035);
    enter("fadeIn", ".cta-btn", end + 0.1, { duration: 0.3 });
    enter("fadeIn", ".cta-handle", end + 0.4);
    cursor(tl, q, ".cta-head", end, duration);
  },
});
