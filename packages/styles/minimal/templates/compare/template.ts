import { defineTemplate } from "@makvid/style-kit";

export default defineTemplate({
  id: "compare",
  build({ enter }) {
    enter("fadeUp", ".cmp-title", 0.05);
    enter("fadeUp", ".card.left", 0.35);
    enter("fadeIn", ".card.left .ci", 0.6, { stagger: 0.18 });
    enter("fadeUp", ".card.right", 1.1);
    enter("fadeIn", ".card.right .ci", 1.35, { stagger: 0.18 });
  },
});
