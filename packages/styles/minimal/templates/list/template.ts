import { defineTemplate } from "@makvid/style-kit";

export default defineTemplate({
  id: "list",
  build({ enter, duration }) {
    enter("fadeUp", ".list-title", 0.05);
    const step = Math.min(0.45, (duration - 1.6) / 5);
    enter("pop", ".bullet", 0.45, { stagger: step, ease: "back.out", duration: 0.45 });
    enter("slideRight", ".item-text", 0.5, { stagger: step, duration: 0.5 });
  },
});
