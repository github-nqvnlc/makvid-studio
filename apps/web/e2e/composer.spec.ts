// Spec 003: the chat-style composer (content type, aspect, length, voice dialog, mode, summary, start).
import { expect, test } from "@playwright/test";
import { pickType, setMode, signUp } from "./helpers";

test.describe("create composer", () => {
  test.beforeEach(async ({ page }) => {
    await signUp(page, "composer");
    await page.goto("/vi/projects/new");
    await expect(page.getByTestId("composer")).toBeVisible();
  });

  test("six content types; the input follows the type and keeps earlier text", async ({ page }) => {
    await page.getByTestId("type-trigger").click();
    for (const k of ["prompt", "script", "url", "github", "table", "media"])
      await expect(page.getByTestId(`source-${k}`)).toBeVisible();
    await expect(page.locator('[data-testid^="source-"]')).toHaveCount(6);
    await page.keyboard.press("Escape");

    await page.locator('textarea[name="prompt"]').fill("Lãi kép là gì");
    await pickType(page, "url");
    await expect(page.locator('input[name="link"]')).toBeVisible();
    await expect(page.locator('textarea[name="prompt"]')).toHaveCount(0);
    await pickType(page, "prompt");
    await expect(page.locator('textarea[name="prompt"]')).toHaveValue("Lãi kép là gì");

    await pickType(page, "table");
    await expect(page.locator('input[name="file"]')).toHaveCount(1);
  });

  test("four aspect ratios, 9:16 by default", async ({ page }) => {
    await expect(page.getByTestId("aspect-trigger")).toContainText("9:16");
    await page.getByTestId("aspect-trigger").click();
    await expect(page.locator('[data-testid^="aspect-"]:not([data-testid="aspect-trigger"])')).toHaveCount(4);
    await page.getByTestId("aspect-16:9").click();
    await expect(page.getByTestId("aspect-trigger")).toContainText("16:9");
    await expect(page.getByTestId("create-summary")).toContainText("16:9");
  });

  test("length 30-180 is enforced", async ({ page }) => {
    const input = page.getByTestId("length-input");
    const start = page.getByTestId("create-submit");
    for (const bad of ["29", "181", "abc", "45.5", ""]) {
      await input.fill(bad);
      await expect(page.getByTestId("length-error")).toBeVisible();
      await expect(start).toBeDisabled();
    }
    // 30 and 180 are valid lengths; Start may still be blocked by the plan's own maximum (shown separately).
    await input.fill("30");
    await expect(page.getByTestId("length-error")).toHaveCount(0);
    await expect(start).toBeEnabled();
    await input.fill("180");
    await expect(page.getByTestId("length-error")).toHaveCount(0);
  });

  test("content problems are explained and nothing is sent", async ({ page }) => {
    let posted = false;
    await page.route("**/api/projects", (r) => ((posted = r.request().method() === "POST"), r.continue()));
    await page.getByTestId("create-submit").click();
    await expect(page.getByTestId("create-error")).toBeVisible();
    await pickType(page, "url");
    await page.locator('input[name="link"]').fill("not a link");
    await page.getByTestId("create-submit").click();
    await expect(page.getByTestId("create-error")).toContainText("http");
    expect(posted).toBe(false);
  });

  test("voice dialog: preview one at a time, confirm, dismiss keeps the choice", async ({ page }) => {
    const button = page.getByTestId("voice-button");
    const before = (await button.textContent())?.trim();
    await button.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    const rows = dialog.locator('[data-testid^="voice-listen-"]');
    expect(await rows.count()).toBeGreaterThan(1);
    // Pick the second voice and confirm.
    const second = dialog.locator('li[data-testid^="voice-"]').nth(1);
    const name = (await second.getByRole("button", { pressed: false }).first().getAttribute("aria-label")) ?? "";
    await second.getByRole("button", { pressed: false }).first().click();
    await page.getByTestId("voice-confirm").click();
    await expect(dialog).toBeHidden();
    await expect(button).toContainText(name);
    await expect(page.getByTestId("create-summary")).toContainText(name);
    // Dismissing leaves the choice unchanged.
    await button.click();
    await page.keyboard.press("Escape");
    await expect(button).toContainText(name);
    expect(before).not.toBe(name);
  });

  test("mode toggle updates the summary", async ({ page }) => {
    const toggle = page.getByTestId("mode-toggle");
    await expect(toggle).toHaveAttribute("aria-checked", "false");
    await expect(page.getByTestId("create-summary")).toContainText("Tự động");
    await setMode(page, "review");
    await expect(page.getByTestId("create-summary")).toContainText("Duyệt từng bước");
  });

  test("start creates one project and opens its page (double click)", async ({ page }) => {
    let posts = 0;
    await page.route("**/api/projects", (r) => {
      if (r.request().method() === "POST") posts++;
      return r.continue();
    });
    await page.locator('textarea[name="prompt"]').fill("Ba mẹo giữ thói quen đọc sách");
    await page.getByTestId("length-input").fill("30");
    await expect(page.getByTestId("summary-preview")).toContainText("Ba mẹo");
    await page.getByTestId("create-submit").dblclick();
    await page.waitForURL(/\/projects\/[0-9a-f-]{36}$/);
    expect(posts).toBe(1);
  });

  test("works at 360 px without horizontal scroll", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    await page.goto("/vi/projects/new");
    await expect(page.getByTestId("composer")).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(overflow).toBe(false);
  });
});
