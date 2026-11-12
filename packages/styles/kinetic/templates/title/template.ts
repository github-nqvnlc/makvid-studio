import { defineTemplate, explodeGraphemes } from "@makvid/style-kit";

export default defineTemplate({
  id: "title",
  build({ tl, enter, qa }) {
    tl.fromTo(".deco", { scaleX: 0 }, { scaleX: 1 }, { duration: 0.5, ease: "power4.out" }, 0);
    const letters = explodeGraphemes(qa(".title-text .w"));
    tl.fromTo(
      letters,
      { opacity: 0, scale: 2.2 },
      { opacity: 1, scale: 1 },
      { duration: 0.35, ease: "power3.out", stagger: 0.02 },
      0.1,
    );
    enter("fadeUp", ".subtitle", 0.8, { duration: 0.4 });
  },
});
