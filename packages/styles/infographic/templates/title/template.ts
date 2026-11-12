import { defineTemplate } from "@makvid/style-kit";

export default defineTemplate({
  id: "title",
  build({ tl, enter }) {
    tl.fromTo(
      ".deco",
      { opacity: 0, rotation: 90 },
      { opacity: 1, rotation: 0 },
      { duration: 1.4, ease: "power3.out" },
      0,
    );
    enter("fadeUp", ".title-text .w", 0.15, { stagger: 0.05 });
    enter("fadeIn", ".subtitle", 0.8);
  },
});
