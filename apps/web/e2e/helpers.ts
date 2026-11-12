import { expect, type Page } from "@playwright/test";
import { TEST_PASSWORD, testEmail } from "./fixtures";

export async function signUp(page: Page, tag: string): Promise<string> {
  const email = testEmail(tag);
  await page.goto("/vi/sign-up");
  await page.locator('input[name="name"]').fill("Người dùng thử");
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(TEST_PASSWORD);
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
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(/\/projects\/[0-9a-f-]{36}$/);
}

export async function waitReady(page: Page) {
  await expect(page.getByTestId("project-status")).toHaveText("Sẵn sàng", { timeout: 180_000 });
}
