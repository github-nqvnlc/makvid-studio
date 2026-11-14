// UI-G4: automated accessibility check (axe) on the main pages, both themes. Serious and critical violations fail.
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { signUp } from "./helpers";

async function check(page: Page, where: string) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  const bad = r.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  const text = bad.map((v) => `${v.id} (${v.impact}): ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`);
  expect(text, `${where}\n${text.join("\n")}`).toEqual([]);
}

async function setTheme(page: Page, theme: "light" | "dark") {
  await page.emulateMedia({ colorScheme: theme });
  await page.evaluate((t) => localStorage.setItem("theme", t), theme);
}

for (const theme of ["light", "dark"] as const) {
  test(`public pages have no serious accessibility problems (${theme})`, async ({ page }) => {
    await page.goto("/sign-in");
    await setTheme(page, theme);
    for (const path of ["/", "/pricing", "/sign-in", "/sign-up", "/en"]) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      await check(page, `${path} ${theme}`);
    }
  });

  test(`signed-in pages have no serious accessibility problems (${theme})`, async ({ page }) => {
    test.setTimeout(240_000);
    await signUp(page, `a11y${theme}`);
    await setTheme(page, theme);
    for (const path of ["/", "/projects/new", "/workspace/billing", "/workspace/brand", "/workspace/assets", "/workspace/members", "/workspace/api", "/account", "/batches"]) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      await check(page, `${path} ${theme}`);
    }
  });
}
