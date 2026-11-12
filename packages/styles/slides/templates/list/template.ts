import { defineTemplate, findCue } from "@makvid/style-kit";

export default defineTemplate({
  id: "list",
  build({ tl, enter, qa, narration, duration }) {
    tl.fromTo(".sh-bar", { scaleX: 0 }, { scaleX: 1 }, { duration: 0.6, ease: "power3.out" }, 0);
    enter("fadeIn", ".sh-dots i", 0.1, { stagger: 0.08, duration: 0.3 });
    enter("fadeUp", ".list-title", 0.05);
    const items = qa<HTMLElement>(".item");
    const step = Math.min(0.6, (duration - 1.6) / Math.max(items.length, 1));
    let after = 0.4;
    items.forEach((it, i) => {
      const fallback = 0.6 + i * step;
      const cue = findCue(narration, it.querySelector(".item-text")?.textContent ?? "", after);
      const at = Math.max(0.5, Math.min(cue ?? fallback, duration - 0.8));
      after = at + 0.05;
      enter("slideRight", it, at, { duration: 0.45 });
    });
  },
});
