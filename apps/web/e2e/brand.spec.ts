// US8 (T125): brand kit page — logo upload, a font without Vietnamese is refused with a friendly message, a full
// font is accepted, the kit is saved and a video is produced with the brand turned on.
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { expect, test } from "@playwright/test";
import { signUp, waitReady } from "./helpers";

const root = resolve(import.meta.dirname, "../../..");
// A complete local font with Vietnamese glyphs (Windows ships Arial); the font is only read, never committed.
const FULL_FONT = ["C:/Windows/Fonts/arial.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"].find(
  existsSync,
);

test("brand kit: upload, validation, save, produce with brand", async ({ page }) => {
  await signUp(page, "brand");
  await page.goto("/vi/workspace/brand");
  // A low-contrast pair is flagged live and blocks saving.
  await page.getByTestId("color-fg").fill("#20252c");
  await page.getByTestId("color-bg").fill("#1b1f24");
  await expect(page.getByTestId("contrast-warning")).toBeVisible();
  await expect(page.getByTestId("brand-save")).toBeDisabled();
  // A readable full palette.
  const palette = {
    bg: "#102a43",
    fg: "#f0f4f8",
    muted: "#bcccdc",
    surface: "#243b53",
    accent: "#f7c948",
    accentInk: "#102a43",
  };
  for (const [k, v] of Object.entries(palette)) await page.getByTestId(`color-${k}`).fill(v);
  await expect(page.getByTestId("contrast-warning")).toHaveCount(0);
  await page.getByTestId("upload-logo").setInputFiles(join(root, "fixtures/brand/logo.svg"));
  await expect(page.locator("select").first()).toHaveValue(/[0-9a-f-]{36}/);

  // A subset font (latin only) cannot render Vietnamese: refused with a plain-language message.
  await page
    .getByTestId("upload-font-display")
    .setInputFiles(join(root, "packages/styles/slides/fonts/lexend-latin-800-normal.woff2"));
  await expect(page.getByTestId("brand-message")).toHaveText(/thiếu một số chữ tiếng Việt/);

  if (FULL_FONT) await page.getByTestId("upload-font-display").setInputFiles(FULL_FONT);
  await page.getByTestId("brand-save").click();
  await expect(page.getByTestId("brand-message")).toHaveText(/Đã lưu/);

  await page.goto("/vi/workspace/assets");
  await expect(page.getByTestId("asset-list").locator("li")).toHaveCount(FULL_FONT ? 2 : 1);

  await page.goto("/vi/projects/new");
  await expect(page.getByTestId("use-brand")).toBeChecked();
  await page.locator('textarea[name="prompt"]').fill("Ba mẹo giữ thói quen đọc sách");
  await page.locator('input[name="duration"]').fill("30");
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(/\/projects\/[0-9a-f-]{36}$/);
  await waitReady(page);
  await expect(page.getByTestId("preview-video")).toBeVisible();
});
