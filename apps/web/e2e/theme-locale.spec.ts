// UI-G1 (spec 002 US2): theme and language switching keep state, URL and query; no hydration warnings.
import { expect, test } from "@playwright/test";

test("language switch keeps the page and the query", async ({ page }) => {
  await page.goto("/en/sign-in?a=1");
  await page.getByTestId("locale-switcher").click();
  await page.getByRole("menuitemradio", { name: "Tiếng Việt" }).click();
  await expect.poll(() => new URL(page.url()).pathname + new URL(page.url()).search).toBe("/sign-in?a=1");
  const cookies = await page.context().cookies();
  expect(cookies.find((c) => c.name === "NEXT_LOCALE")?.value).toBe("vi");
});

test("theme choice persists across reload and does not warn about hydration", async ({ page }) => {
  const warnings: string[] = [];
  page.on("console", (m) => {
    if (/hydrat/i.test(m.text())) warnings.push(m.text());
  });
  await page.goto("/sign-in");
  await page.getByTestId("theme-toggle").click();
  await page.getByRole("menuitemradio", { name: "Tối" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.reload();
  await expect(page.locator("html")).toHaveClass(/dark/);
  expect(warnings).toEqual([]);
});

test("first paint follows the OS dark preference", async ({ browser }) => {
  const ctx = await browser.newContext({ colorScheme: "dark" });
  const page = await ctx.newPage();
  await page.goto("/sign-in");
  await expect(page.locator("html")).toHaveClass(/dark/);
  await ctx.close();
});
