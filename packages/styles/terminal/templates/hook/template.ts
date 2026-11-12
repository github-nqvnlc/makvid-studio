import { defineTemplate } from "@makvid/style-kit";
import { typeText, highlightSyntax, cursor } from "../../lib/term";

export default defineTemplate({
  id: "hook",
  build({ tl, enter, q, qa, duration }) {
    highlightSyntax(qa);
    enter("fadeDown", ".term-bar", 0, { duration: 0.35 });
    enter("fadeIn", ".kicker", 0.2);
    const end = typeText(tl, qa, ".headline", 0.35, 0.04);
    cursor(tl, q, ".headline", end, duration);
    tl.fromTo(".rule", { scaleX: 0 }, { scaleX: 1 }, { duration: 0.5, ease: "power2.out" }, end);
  },
});
