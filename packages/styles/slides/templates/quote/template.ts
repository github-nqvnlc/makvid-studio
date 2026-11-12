import { defineTemplate } from "@makvid/style-kit";

export default defineTemplate({
  id: "quote",
  build({ tl, enter }) {
    tl.fromTo(".sh-bar", { scaleX: 0 }, { scaleX: 1 }, { duration: 0.6, ease: "power3.out" }, 0);
    enter("fadeIn", ".sh-dots i", 0.1, { stagger: 0.08, duration: 0.3 });
    enter("fadeDown", ".qmark", 0, { duration: 0.7 });
    enter("fadeUp", ".q-text .ln", 0.25, { stagger: 0.14 });
    enter("fadeIn", ".q-author", 1.1);
  },
});
