import { defineTemplate } from "@makvid/style-kit";
import { typeText, highlightSyntax, cursor } from "../../lib/term";

export default defineTemplate({
  id: "title",
  build({ tl, enter, q, qa, duration }) {
    highlightSyntax(qa);
    enter("fadeDown", ".term-bar", 0, { duration: 0.35 });
    const end = typeText(tl, qa, ".title-text", 0.3, 0.035);
    cursor(tl, q, ".title-text", end, duration);
    enter("fadeIn", ".subtitle", end + 0.1);
  },
});
