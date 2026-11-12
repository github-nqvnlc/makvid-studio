import { defineTemplate, findCue } from "@makvid/style-kit";

export default defineTemplate({
  id: "compare",
  build({ tl, enter, qa, narration, duration }) {
    tl.fromTo(".sh-bar", { scaleX: 0 }, { scaleX: 1 }, { duration: 0.6, ease: "power3.out" }, 0);
    enter("fadeIn", ".sh-dots i", 0.1, { stagger: 0.08, duration: 0.3 });
    enter("fadeUp", ".cmp-title", 0.05);
    const left = findCue(narration, qa(".card.left .card-label")[0]?.textContent ?? "") ?? 0.4;
    const right = findCue(narration, qa(".card.right .card-label")[0]?.textContent ?? "", left + 0.1) ?? 1.1;
    const l = Math.min(left, duration - 1.5);
    const r = Math.min(Math.max(right, l + 0.4), duration - 1);
    enter("fadeUp", ".card.left", l);
    enter("fadeIn", ".card.left .ci", l + 0.25, { stagger: 0.15 });
    enter("fadeUp", ".card.right", r);
    enter("fadeIn", ".card.right .ci", r + 0.25, { stagger: 0.15 });
  },
});
