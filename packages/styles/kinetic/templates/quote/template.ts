import { defineTemplate } from "@makvid/style-kit";

export default defineTemplate({
  id: "quote",
  build({ tl, enter, qa }) {
    tl.fromTo(
      ".qmark",
      { opacity: 0, scale: 0.3, rotation: -20 },
      { opacity: 1, scale: 1, rotation: 0 },
      { duration: 0.5, ease: "back.out" },
      0,
    );
    tl.fromTo(
      qa(".q-text .w"),
      { opacity: 0, y: 30 },
      { opacity: 1, y: 0 },
      { duration: 0.3, ease: "power3.out", stagger: 0.05 },
      0.25,
    );
    enter("fadeIn", ".q-author", 1.3, { duration: 0.5 });
  },
});
