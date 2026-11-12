import { expect, type Page } from "@playwright/test";
import { TEST_PASSWORD, testEmail } from "./fixtures";

export async function signUp(page: Page, tag: string): Promise<string> {
  const email = testEmail(tag);
  await page.goto("/vi/sign-up");
  await page.locator('input[name="name"]').fill("Người dùng thử");
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(TEST_PASSWORD);
  await shot(page, "sign-up");
  await page.locator('button[type="submit"]').click();
  await expect(page.getByRole("link", { name: "Tạo video" }).first()).toBeVisible();
  return email;
}

/** Create a project from the UI and wait until its first video is ready. */
export async function createVideo(page: Page, idea: string, mode: "auto" | "review" = "auto") {
  await page.goto("/vi/projects/new");
  await page.locator('textarea[name="prompt"]').fill(idea);
  await page.locator('input[name="duration"]').fill("30");
  await page.getByTestId(`mode-${mode}`).click();
  await shot(page, "create");
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(/\/projects\/[0-9a-f-]{36}$/);
}

export async function waitReady(page: Page) {
  await expect(page.getByTestId("project-status")).toHaveText("Sẵn sàng", { timeout: 180_000 });
}

let shotN = 0;
/** E2E_SHOTS=<dir>: numbered screenshots of each step (assembled into the milestone walkthrough). */
export async function shot(page: Page, name: string) {
  const dir = process.env.E2E_SHOTS;
  if (!dir) return;
  await page.screenshot({ path: `${dir}/${String(++shotN).padStart(2, "0")}-${name}.png` });
}
