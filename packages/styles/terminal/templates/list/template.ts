import { defineTemplate, explodeGraphemes } from "@makvid/style-kit";
import { typeText, highlightSyntax } from "../../lib/term";

export default defineTemplate({
  id: "list",
  build({ tl, enter, qa, duration }) {
    highlightSyntax(qa);
    enter("fadeDown", ".term-bar", 0, { duration: 0.35 });
    let t = typeText(tl, qa, ".list-title", 0.25, 0.03);
    const items = qa<HTMLElement>(".item");
    const budget = Math.max(0.6, (duration - t - 1) / Math.max(items.length, 1));
    items.forEach((it, i) => {
      const at = t + 0.15 + i * 0.05;
      enter("fadeIn", it.querySelector(".bullet")!, at, { duration: 0.15 });
      const g = explodeGraphemes(Array.from(it.querySelectorAll(".item-text .w")));
      const per = Math.min(0.03, (budget - 0.2) / Math.max(g.length, 1));
      g.forEach((el, k) => tl.set(el, { opacity: 0 }, 0).set(el, { opacity: 1 }, at + 0.1 + k * per));
      t = at + 0.1 + g.length * per;
    });
  },
});
