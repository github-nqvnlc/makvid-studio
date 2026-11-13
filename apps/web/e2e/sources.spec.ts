// T117: the source picker on the create page — written script, data file and audio upload end to end
// (mock providers), plus friendly errors for a wrong file type.
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { expect, test } from "@playwright/test";
import { signUp, waitReady } from "./helpers";

const fixtures = resolve(import.meta.dirname, "../../../fixtures/sources");

test("create videos from a written script, a data file and an audio recording", async ({ page }) => {
  await signUp(page, "sources");

  // Written script: the narration on the review screen is exactly the user's text.
  await page.goto("/vi/projects/new");
  await page.getByTestId("source-script").click();
  const script = readFileSync(join(fixtures, "script-vi.txt"), "utf8");
  await page.locator('textarea[name="script"]').fill(script);
  await page.getByTestId("mode-review").click();
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(/\/projects\/[0-9a-f-]{36}$/);
  await expect(page.getByTestId("script-review")).toBeVisible({ timeout: 120_000 });
  const first = await page.getByTestId("script-review").locator("textarea").first().inputValue();
  expect(first).toBe("Bạn có biết mỗi ngày chúng ta lướt điện thoại hơn năm tiếng không?");

  // Data file.
  await page.goto("/vi/projects/new");
  await page.getByTestId("source-table").click();
  await page.locator('input[name="file"]').setInputFiles(join(fixtures, "gia-vang.csv"));
  await page.locator('input[name="duration"]').fill("30");
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(/\/projects\/[0-9a-f-]{36}$/);
  await waitReady(page);

  // A wrong file for "data" gets a friendly message, not an error dump.
  await page.goto("/vi/projects/new");
  await page.getByTestId("source-table").click();
  await page.locator('input[name="file"]').setInputFiles({
    name: "data.csv",
    mimeType: "text/csv",
    buffer: Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03]), // an executable renamed to .csv
  });
  await page.locator('button[type="submit"]').click();
  await expect(page.locator("p.error[role=alert]")).toHaveText(/Loại file này chưa được hỗ trợ/);

  // Audio recording, keeping the original voice.
  const dir = mkdtempSync(join(tmpdir(), "e2e-audio-"));
  const wav = join(dir, "ghi-am.wav");
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "lavfi", "-i", "sine=frequency=200:duration=10", wav]);
  await page.goto("/vi/projects/new");
  await page.getByTestId("source-media").click();
  await page.locator('input[name="file"]').setInputFiles(wav);
  await page.locator('input[name="duration"]').fill("30");
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(/\/projects\/[0-9a-f-]{36}$/);
  await waitReady(page);
  await expect(page.getByTestId("preview-video")).toBeVisible();
});
