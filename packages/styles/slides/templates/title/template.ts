import { defineTemplate } from "@makvid/style-kit";

export default defineTemplate({
  id: "title",
  build({ tl, enter }) {
    tl.fromTo(".sh-bar", { scaleX: 0 }, { scaleX: 1 }, { duration: 0.6, ease: "power3.out" }, 0);
    enter("fadeIn", ".sh-dots i", 0.1, { stagger: 0.08, duration: 0.3 });
    enter("fadeUp", ".title-text .ln", 0.15, { stagger: 0.12 });
    enter("slideRight", ".subtitle", 0.7);
  },
});
