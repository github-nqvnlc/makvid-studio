import { defineTemplate } from "@makvid/style-kit";

export default defineTemplate({
  id: "hook",
  build({ tl, enter }) {
    tl.fromTo(
      ".deco",
      { opacity: 0, rotation: -90, scale: 0.8 },
      { opacity: 1, rotation: 0, scale: 1 },
      { duration: 1.2, ease: "power3.out" },
      0,
    );
    enter("fadeUp", ".kicker", 0.1);
    enter("fadeUp", ".headline .ln", 0.25, { stagger: 0.12 });
    tl.fromTo(".rule", { scaleX: 0 }, { scaleX: 1 }, { duration: 0.8, ease: "power3.inOut" }, 0.7);
  },
});
