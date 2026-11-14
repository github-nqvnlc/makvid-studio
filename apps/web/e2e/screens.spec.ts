// Screenshots for gate reports: every listed page x light/dark x vi/en x 1280/360.
// SCREENS_PHASE names the output folder (docs/reports/ui/<phase>/); SCREENS_PAGES = comma list of paths.
// SCREENS_AUTH=1 signs up a fresh user first, so signed-in pages can be captured.
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { test } from "@playwright/test";
import { TEST_PASSWORD, testEmail } from "./fixtures";

const PHASE = process.env.SCREENS_PHASE ?? "ui-g1";
const PAGES = (process.env.SCREENS_PAGES ?? "/sign-in,/sign-up").split(",");
const AUTH = process.env.SCREENS_AUTH === "1";
const OUT = join(process.cwd(), "..", "..", "docs", "reports", "ui", PHASE);

for (const theme of ["light", "dark"] as const)
  for (const locale of ["vi", "en"] as const)
    for (const width of [1280, 360] as const)
      test(`screen set ${theme} ${locale} ${width}`, async ({ browser }) => {
        test.setTimeout(300_000);
        mkdirSync(OUT, { recursive: true });
        const ctx = await browser.newContext({
          colorScheme: theme,
          viewport: { width, height: width === 1280 ? 800 : 740 },
        });
        const page = await ctx.newPage();
        await page.addInitScript((t) => localStorage.setItem("theme", t), theme);
        if (AUTH) {
          await page.goto(`/${locale}/sign-up`);
          await page.locator('input[name="name"]').fill("Người dùng thử");
          await page.locator('input[name="email"]').fill(testEmail(`shot${theme}${locale}${width}`));
          await page.locator('input[name="password"]').fill(TEST_PASSWORD);
          await page.locator('button[type="submit"]').click();
          await page.waitForURL((u) => !/sign-up/.test(u.pathname), { timeout: 60_000 });
        }
        for (const path of PAGES) {
          await page.goto(`/${locale}${path === "/" ? "" : path}`);
          await page.waitForLoadState("networkidle");
          const name = `${path.replace(/\W+/g, "_").replace(/^_/, "") || "home"}.${theme}.${locale}.${width}.png`;
          await page.screenshot({ path: join(OUT, name), fullPage: true });
        }
        await ctx.close();
      });
