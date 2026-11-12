import { defineTemplate } from "@makvid/style-kit";

export default defineTemplate({
  id: "quote",
  build({ enter }) {
    enter("pop", ".qmark", 0, { ease: "back.out" });
    enter("fadeUp", ".q-text .ln", 0.3, { stagger: 0.14 });
    enter("fadeIn", ".q-author", 1.2);
  },
});
