import { defineTemplate, explodeGraphemes } from "@makvid/style-kit";

export default defineTemplate({
  id: "cta",
  build({ tl, enter, qa }) {
    tl.fromTo(".deco", { scaleX: 0 }, { scaleX: 1 }, { duration: 0.5, ease: "power4.out" }, 0);
    const letters = explodeGraphemes(qa(".cta-head .w"));
    tl.fromTo(
      letters,
      { opacity: 0, y: -60 },
      { opacity: 1, y: 0 },
      { duration: 0.35, ease: "back.out", stagger: 0.018 },
      0.1,
    );
    tl.fromTo(
      ".cta-btn",
      { opacity: 0, scale: 0.5 },
      { opacity: 1, scale: 1 },
      { duration: 0.45, ease: "back.out" },
      0.9,
    );
    for (let i = 0; i < 3; i++) {
      tl.fromTo(
        ".cta-btn",
        { rotation: 0 },
        { rotation: -3 },
        { duration: 0.12, ease: "sine.inOut" },
        1.6 + i * 0.5,
      );
      tl.fromTo(
        ".cta-btn",
        { rotation: -3 },
        { rotation: 0 },
        { duration: 0.12, ease: "sine.inOut" },
        1.72 + i * 0.5,
      );
    }
    enter("fadeIn", ".cta-handle", 1.2);
  },
});
