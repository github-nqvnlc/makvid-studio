import { defineTemplate } from "@makvid/style-kit";
import { typeText, highlightSyntax } from "../../lib/term";

export default defineTemplate({
  id: "highlight",
  build({ tl, enter, qa }) {
    highlightSyntax(qa);
    enter("fadeDown", ".term-bar", 0, { duration: 0.35 });
    typeText(tl, qa, ".hl-text", 0.25, 0.025);
  },
});
