import { defineTemplate } from "@makvid/style-kit";

export default defineTemplate({
  id: "compare",
  build({ enter }) {
    enter("fadeUp", ".cmp-title", 0.05);
    enter("fadeUp", ".card", 0.35, { stagger: 0.5 });
    enter("slideRight", ".card.left .ci", 0.6, { stagger: 0.15, duration: 0.4 });
    enter("slideRight", ".card.right .ci", 1.1, { stagger: 0.15, duration: 0.4 });
  },
});
