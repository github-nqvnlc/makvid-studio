import { defineTemplate } from "@makvid/style-kit";

export default defineTemplate({
  id: "title",
  build({ enter, tl }) {
    enter("fadeIn", ".deco", 0, { duration: 1.2, ease: "sine.out" });
    enter("fadeUp", ".title-text .ln", 0.15, { stagger: 0.12 });
    enter("fadeUp", ".subtitle", 0.7);
    tl.fromTo(".deco", { scale: 0.92 }, { scale: 1 }, { duration: 3, ease: "sine.out" }, 0);
  },
});
