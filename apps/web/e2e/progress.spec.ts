// Spec 003: live progress with an activity log per stage (stages, log lines, reload, review pause, no tech names).
import { expect, test } from "@playwright/test";
import { createVideo, signUp } from "./helpers";

const TECH = /hyperframes|gsap|ffmpeg|chrome|puppeteer|fpt|openai|bullmq|postgres|redis|valkey|stack trace|ECONN/i;

test("live log appears, survives a reload, filters by stage and names no technology", async ({ page }) => {
  await signUp(page, "progress");
  await createVideo(page, "Ba mẹo giữ thói quen đọc sách", "auto");

  const panel = page.getByTestId("progress");
  await expect(panel).toBeVisible();
  await expect(page.getByTestId("stage-script")).toBeVisible();
  // Lines arrive without a manual refresh.
  await expect(page.getByTestId("log-entry").first()).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId("activity-log")).toContainText("lời đọc", { timeout: 60_000 });
  const before = await page.getByTestId("log-entry").count();
  expect(before).toBeGreaterThan(0);

  // Reload: the earlier lines come back from the saved history.
  await page.reload();
  await expect(page.getByTestId("log-entry").first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("activity-log")).toContainText("lời đọc");
  expect(await page.getByTestId("log-entry").count()).toBeGreaterThanOrEqual(before);

  // Filter by one stage, then back to all.
  await page.getByTestId("stage-script").click();
  const entries = page.getByTestId("log-entry");
  await expect(entries.first()).toBeVisible();
  await page.getByRole("button", { name: "Xem tất cả các bước" }).click();

  // No technical names anywhere in the progress area.
  expect(await panel.innerText()).not.toMatch(TECH);
});

test("step-by-step: the page says it waits for the user and the log notes the pause", async ({ page }) => {
  await signUp(page, "progress-review");
  await createVideo(page, "Ba mẹo giữ thói quen đọc sách", "review");
  await expect(page.getByTestId("waiting-for-you")).toBeVisible({ timeout: 120_000 });
  await expect(page.getByTestId("stage-script")).toHaveAttribute("data-state", "needs_approval");
  await expect(page.getByTestId("activity-log")).toContainText("chờ bạn duyệt");
  await expect(page.getByTestId("script-review")).toBeVisible();
  // Approving continues the run, and the log says so.
  await page.getByTestId("script-review").getByRole("button", { name: /tiếp tục/i }).click();
  await expect(page.getByTestId("activity-log")).toContainText("Bạn đã duyệt lời đọc", { timeout: 60_000 });
  await expect(page.getByTestId("stage-script")).toHaveAttribute("data-state", "done", { timeout: 60_000 });
});

test("log stays on screen and scrolling up pauses following", async ({ page }) => {
  await signUp(page, "progress-scroll");
  await createVideo(page, "Ba mẹo giữ thói quen đọc sách", "auto");
  await expect(page.getByTestId("log-entry").first()).toBeVisible({ timeout: 60_000 });
  // Make the box overflow with synthetic lines, then scroll up: the jump control must appear.
  await page.getByTestId("activity-log").evaluate((el) => {
    el.style.height = "60px";
    el.scrollTop = 0;
    el.dispatchEvent(new Event("scroll"));
  });
  await expect(page.getByTestId("log-jump-latest")).toBeVisible();
  await page.getByTestId("log-jump-latest").click();
  await expect(page.getByTestId("log-jump-latest")).toHaveCount(0);
});
