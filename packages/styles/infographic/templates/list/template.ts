import { defineTemplate } from "@makvid/style-kit";

export default defineTemplate({
  id: "list",
  build({ tl, enter, qa, duration }) {
    enter("fadeUp", ".list-title", 0.05);
    const items = qa(".item");
    const step = Math.min(0.5, (duration - 1.6) / Math.max(items.length, 1));
    items.forEach((it, i) => {
      const bar = it.ownerDocument.createElement("span");
      bar.className = "progress";
      bar.style.width = `${Math.round(((i + 1) / items.length) * 100)}%`;
      it.appendChild(bar);
      const at = 0.4 + i * step;
      tl.fromTo(it, { opacity: 0, y: 20 }, { opacity: 1, y: 0 }, { duration: 0.4, ease: "power3.out" }, at);
      tl.fromTo(bar, { scaleX: 0 }, { scaleX: 1 }, { duration: 0.8, ease: "power2.inOut" }, at + 0.15);
    });
  },
});
