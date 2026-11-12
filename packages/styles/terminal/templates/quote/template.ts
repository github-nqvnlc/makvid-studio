import { defineTemplate } from "@makvid/style-kit";
import { typeText, highlightSyntax } from "../../lib/term";

export default defineTemplate({
  id: "quote",
  build({ tl, enter, qa }) {
    highlightSyntax(qa);
    enter("fadeDown", ".term-bar", 0, { duration: 0.35 });
    enter("fadeIn", ".qmark", 0.1, { duration: 0.3 });
    const end = typeText(tl, qa, ".q-text", 0.3, 0.03);
    enter("fadeIn", ".q-author", end + 0.2);
  },
});
