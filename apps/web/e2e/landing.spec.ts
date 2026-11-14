// UI-G2 (spec 002 US7): guest landing, pricing, 404, mobile menu, sign-up -> sign-out -> sign-in.
import { expect, test } from "@playwright/test";
import { TEST_PASSWORD, testEmail } from "./fixtures";

test("guest landing shows its blocks in both locales", async ({ page }) => {
  for (const [path, title] of [
    ["/", "Biến ý tưởng thành video ngắn"],
    ["/en", "Turn an idea into a short video"],
  ] as const) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(title);
    await expect(page.locator("#features")).toBeVisible();
    await expect(page.locator("#styles")).toBeVisible();
    await expect(page.getByRole("heading", { level: 2 }).first()).toBeVisible();
    await expect(page.locator("footer")).toBeVisible();
    expect(await page.locator("#styles img").count()).toBeGreaterThan(5);
  }
});

test("pricing lists the plans with Free labelled and yearly disabled", async ({ page }) => {
  await page.goto("/pricing");
  await expect(page.getByTestId("pricing-plans").locator("> li")).not.toHaveCount(0);
  await expect(page.getByTestId("plan-free")).toContainText("Miễn phí");
  await expect(page.getByRole("radio", { name: "Theo năm" })).toBeDisabled();
});

test("unknown URLs end in the themed 404", async ({ page }) => {
  for (const path of ["/khong-co-trang-nay", "/en/nope/at/all"]) {
    const res = await page.goto(path);
    expect(res?.status()).toBe(404);
    await expect(page.getByTestId("empty-state")).toBeVisible();
  }
});

test("mobile menu opens in a sheet", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 360, height: 740 } });
  const page = await ctx.newPage();
  await page.goto("/");
  await page.getByTestId("mobile-menu").click();
  await expect(page.getByRole("dialog").getByRole("link", { name: "Bảng giá" })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
  await ctx.close();
});

test("sign up, sign out, sign in with field errors", async ({ page }) => {
  await page.goto("/sign-up");
  await page.locator('button[type="submit"]').click();
  await expect(page.getByText("Bạn nhập tên giúp mình nhé.")).toBeVisible();
  const email = testEmail("landing");
  await page.locator('input[name="name"]').fill("Người dùng thử");
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Hiện mật khẩu" }).click();
  await expect(page.locator('input[name="password"]')).toHaveAttribute("type", "text");
  await page.locator('button[type="submit"]').click();
  await expect(page.getByRole("link", { name: "Tạo video" }).first()).toBeVisible();
  await page.getByTestId("user-menu").click();
  await page.getByRole("menuitem", { name: "Đăng xuất" }).click();
  await expect(page.getByRole("link", { name: "Dùng thử miễn phí" }).first()).toBeVisible();
  await page.goto("/sign-in");
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(TEST_PASSWORD);
  await page.locator('button[type="submit"]').click();
  await expect(page.getByRole("link", { name: "Tạo video" }).first()).toBeVisible();
});
