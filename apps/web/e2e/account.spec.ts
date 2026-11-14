// UI-G3 (spec 002 US9): profile name, avatar (rejected and accepted), wrong password, new password sign-in.
import { expect, test } from "@playwright/test";
import { TEST_PASSWORD } from "./fixtures";
import { signUp } from "./helpers";

// 1x1 PNG.
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

test("profile: rename, avatar, password change", async ({ page }) => {
  test.setTimeout(150_000);
  const email = await signUp(page, "account");
  await page.goto("/account");

  // Rename.
  await page.getByLabel("Tên hiển thị").fill("Tên Mới Của Tôi");
  await page.getByTestId("profile-save").click();
  await expect(page.getByText("Đã lưu hồ sơ.")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Tên hiển thị")).toHaveValue("Tên Mới Của Tôi");

  // A file that claims to be a picture but is not one is refused; a real picture is accepted and shown.
  await page.getByTestId("avatar-input").setInputFiles({ name: "x.png", mimeType: "image/png", buffer: Buffer.from("not an image at all") });
  await expect(page.getByText("Không đọc được ảnh này.")).toBeVisible();
  const saved = page.waitForResponse((r) => r.url().includes("/api/me/avatar") && r.request().method() === "POST");
  await page.getByTestId("avatar-input").setInputFiles({ name: "a.png", mimeType: "image/png", buffer: PNG });
  const { image } = (await (await saved).json()) as { image: string };
  expect(image).toMatch(/^\/api\/avatars\/[0-9a-f-]{36}\?v=[0-9a-f]{8}\.webp$/);
  await expect(page.getByText("Đã cập nhật ảnh đại diện.")).toBeVisible();
  // The picture is served through a short-lived signed redirect, for this user only.
  const redirect = await page.request.get(image, { maxRedirects: 0 });
  expect(redirect.status()).toBe(302);
  expect(redirect.headers().location).toContain("X-Amz-Signature");
  expect((await page.context().browser()!.newContext().then((c) => c.request.get(image, { maxRedirects: 0 }))).status()).toBe(401);

  // Wrong current password shows under that field; the right one changes it.
  await page.getByLabel("Mật khẩu hiện tại").fill("sai-mat-khau-123");
  await page.getByLabel("Mật khẩu mới", { exact: true }).fill("mat-khau-moi-456");
  await page.getByLabel("Nhập lại mật khẩu mới").fill("mat-khau-moi-456");
  await page.getByTestId("password-save").click();
  await expect(page.getByText("Mật khẩu hiện tại chưa đúng.")).toBeVisible();
  await page.getByLabel("Mật khẩu hiện tại").fill(TEST_PASSWORD);
  await page.getByTestId("password-save").click();
  await expect(page.getByText("Đã đổi mật khẩu.")).toBeVisible();

  // Sign out and sign in with the new password.
  await page.getByTestId("user-menu").click();
  await page.getByRole("menuitem", { name: "Đăng xuất" }).click();
  await expect(page.getByRole("link", { name: "Dùng thử miễn phí" }).first()).toBeVisible();
  await page.goto("/sign-in");
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill("mat-khau-moi-456");
  await page.locator('button[type="submit"]').click();
  await expect(page.getByTestId("user-menu")).toBeVisible();
});
