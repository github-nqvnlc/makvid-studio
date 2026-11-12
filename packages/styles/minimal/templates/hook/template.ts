import { defineTemplate } from "@makvid/style-kit";

export default defineTemplate({
  id: "hook",
  build({ tl, enter }) {
    enter("fadeIn", ".deco", 0, { duration: 1.2, ease: "sine.out" });
    enter("fadeUp", ".kicker", 0.1);
    enter("fadeUp", ".headline .w", 0.25, { stagger: 0.06 });
    tl.fromTo(".rule", { scaleX: 0 }, { scaleX: 1 }, { duration: 0.7, ease: "power3.out" }, 0.6);
  },
});
