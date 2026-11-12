import { defineTemplate } from "@makvid/style-kit";

export default defineTemplate({
  id: "list",
  build({ tl, enter, qa, duration }) {
    enter("slideRight", ".list-title", 0.05, { duration: 0.4 });
    const items = qa(".item");
    const step = Math.min(0.5, (duration - 1.4) / Math.max(items.length, 1));
    items.forEach((it, i) => {
      const at = 0.45 + i * step;
      tl.fromTo(
        it.querySelector(".bullet")!,
        { scale: 0, rotation: -90 },
        { scale: 1, rotation: 0 },
        { duration: 0.4, ease: "back.out" },
        at,
      );
      tl.fromTo(
        Array.from(it.querySelectorAll(".item-text .w")),
        { opacity: 0, x: -30 },
        { opacity: 1, x: 0 },
        { duration: 0.3, ease: "power3.out", stagger: 0.04 },
        at + 0.1,
      );
    });
  },
});
