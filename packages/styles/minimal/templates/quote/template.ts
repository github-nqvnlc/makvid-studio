import { defineTemplate } from "@makvid/style-kit";

export default defineTemplate({
  id: "quote",
  build({ enter }) {
    enter("fadeDown", ".qmark", 0, { duration: 0.8 });
    enter("fadeUp", ".q-text .ln", 0.25, { stagger: 0.15, duration: 0.7 });
    enter("fadeIn", ".q-author", 1.2, { duration: 0.8 });
  },
});
