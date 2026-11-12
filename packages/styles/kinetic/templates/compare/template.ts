import { defineTemplate } from "@makvid/style-kit";

export default defineTemplate({
  id: "compare",
  build({ tl, enter }) {
    enter("fadeDown", ".cmp-title", 0.05, { duration: 0.4 });
    tl.fromTo(
      ".card.left",
      { opacity: 0, x: -80 },
      { opacity: 1, x: 0 },
      { duration: 0.45, ease: "power4.out" },
      0.3,
    );
    tl.fromTo(
      ".card.right",
      { opacity: 0, x: 80 },
      { opacity: 1, x: 0 },
      { duration: 0.45, ease: "power4.out" },
      0.9,
    );
    enter("fadeIn", ".card.left .ci", 0.55, { stagger: 0.12, duration: 0.3 });
    enter("fadeIn", ".card.right .ci", 1.15, { stagger: 0.12, duration: 0.3 });
    tl.fromTo(".card.right", { y: 0 }, { y: -12 }, { duration: 0.3, ease: "power2.out" }, 1.8);
    tl.fromTo(".card.right", { y: -12 }, { y: 0 }, { duration: 0.4, ease: "power2.inOut" }, 2.1);
  },
});
