// UI-G1 (spec 002 US2): the three theme font families cover Vietnamese (no fallback glyphs).
import { expect, test } from "@playwright/test";

const SAMPLE = "Ẩ Ỹ Ự ặ ở Đ đ";

test("sans, serif and mono render Vietnamese glyphs from the loaded font", async ({ page }) => {
  await page.goto("/sign-in");
  const result = await page.evaluate(async (sample) => {
    await document.fonts.ready;
    const out: Record<string, boolean> = {};
    for (const cls of ["font-sans", "font-serif", "font-mono"]) {
      const el = document.createElement("span");
      el.className = cls;
      el.textContent = sample;
      document.body.appendChild(el);
      const family = getComputedStyle(el).fontFamily.split(",")[0]!.trim().replace(/"/g, "");
      const loaded = await document.fonts.load(`16px "${family}"`, sample);
      out[cls] = family.length > 0 && loaded.length > 0;
      el.remove();
    }
    return out;
  }, SAMPLE);
  expect(result).toEqual({ "font-sans": true, "font-serif": true, "font-mono": true });
});
