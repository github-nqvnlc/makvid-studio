import { defineTemplate, explodeGraphemes } from "@makvid/style-kit";

export default defineTemplate({
  id: "hook",
  build({ tl, enter, qa }) {
    tl.fromTo(".deco", { scaleX: 0 }, { scaleX: 1 }, { duration: 0.5, ease: "power4.out" }, 0);
    enter("fadeIn", ".kicker", 0.05, { duration: 0.3 });
    const letters = explodeGraphemes(qa(".headline .w"));
    tl.fromTo(
      letters,
      { opacity: 0, y: 70, rotation: -10 },
      { opacity: 1, y: 0, rotation: 0 },
      { duration: 0.45, ease: "back.out", stagger: 0.025 },
      0.15,
    );
    tl.fromTo(".rule", { scaleX: 0 }, { scaleX: 1 }, { duration: 0.4, ease: "power4.out" }, 0.9);
    tl.fromTo(".headline", { scale: 1 }, { scale: 1.03 }, { duration: 2.5, ease: "sine.inOut" }, 0.9);
  },
});
