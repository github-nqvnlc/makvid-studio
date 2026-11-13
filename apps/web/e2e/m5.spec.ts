// M5 end to end (mock providers, mock payments): upgrade with a (mock) checkout, save a video as a template,
// run a batch from a CSV and download the ZIP, invite a viewer who cannot create videos, and check the
// platform-admin totals against usage_records (US5, US6, US9).
//   MAKVID_PAYMENTS=mock node scripts/dev-stack.mjs --mock ; pnpm --filter @makvid/web test:e2e -- m5
import { join, resolve } from "node:path";
import { eq, sql } from "drizzle-orm";
import { expect, test } from "@playwright/test";
import { connect, usageRecords, users, withAdmin } from "@makvid/db";
import { TEST_PASSWORD } from "./fixtures";
import { createVideo, shot, signUp, waitReady } from "./helpers";

const root = resolve(import.meta.dirname, "../../..");
try {
  process.loadEnvFile(join(root, ".env"));
} catch {
  /* env from the shell */
}

test("plan upgrade, template, batch + ZIP, roles, admin totals", async ({ page, browser }) => {
  test.setTimeout(900_000);
  const ownerEmail = await signUp(page, "m5owner");

  // Free plan: watermark notice and no batch.
  await page.goto("/vi/workspace/billing");
  await expect(page.getByTestId("current-plan")).toContainText("Miễn phí");
  await shot(page, "billing-free");
  // Upgrade to Starter through the mock checkout (same signed-webhook path as real providers).
  await page.getByTestId("plan-starter").getByRole("button", { name: "Thẻ quốc tế" }).click();
  await page.waitForURL(/mock-checkout/);
  await page.getByRole("button", { name: "Xác nhận đã thanh toán" }).click();
  await page.waitForURL(/workspace\/billing\?paid=1/);
  await expect(page.getByTestId("current-plan")).toContainText("Cơ bản");
  await shot(page, "billing-starter");

  // A finished video becomes a template with one variable.
  await createVideo(page, "Lãi kép là gì");
  await waitReady(page);
  await page.getByTestId("save-template").click();
  await page.getByLabel("Chữ trong video").first().fill("lãi kép");
  await page.getByLabel("Tên biến (chữ thường, không dấu, dấu _)").first().fill("chu_de");
  await page.getByTestId("template-form").getByRole("button", { name: "Lưu thành mẫu" }).click();
  await expect(page.getByTestId("template-saved")).toContainText("chu_de");
  await shot(page, "template-saved");
  await page.getByRole("link", { name: "Tạo hàng loạt từ mẫu này" }).click();

  // CSV check names a missing column, then a valid file runs.
  await page.getByTestId("batch-file").setInputFiles({
    name: "sai.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("ten,ghi_chu\nAn,x\n"),
  });
  await page.getByRole("button", { name: "Kiểm tra file" }).click();
  await expect(page.getByTestId("batch-check")).toContainText("Thiếu cột: chu_de");
  await page.getByTestId("batch-file").setInputFiles({
    name: "dung.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("chu_de\nquỹ hưu trí\ntiết kiệm vàng\nquỹ học bổng\n", "utf8"),
  });
  await page.getByRole("button", { name: "Kiểm tra file" }).click();
  await expect(page.getByTestId("batch-check")).toContainText("3 dòng hợp lệ");
  await shot(page, "batch-check");
  await page.getByTestId("batch-start").click();
  await page.waitForURL(/\/batches\/[0-9a-f-]{36}$/);
  await expect(page.getByTestId("batch-status")).toHaveText("Hoàn thành", { timeout: 600_000 });
  await expect(page.getByTestId("batch-zip")).toBeVisible({ timeout: 120_000 });
  await expect(page.getByTestId("batch-rows").locator('tr[data-status="succeeded"]')).toHaveCount(3);
  await shot(page, "batch-done");
  const zipUrl = await page.getByTestId("batch-zip").getAttribute("href");
  const zip = await page.request.get(zipUrl!);
  expect(zip.status()).toBe(200);
  expect((await zip.body()).subarray(0, 2).toString("latin1")).toBe("PK");

  // Invite a viewer; they join and cannot create videos.
  await page.goto("/vi/workspace/members");
  const viewerEmail = `e2e-m5viewer-${Date.now()}@example.test`;
  const form = page.getByTestId("invite-form");
  await form.locator('input[type="email"]').fill(viewerEmail);
  await form.locator("select").selectOption("viewer");
  await form.getByRole("button", { name: "Tạo lời mời" }).click();
  const link = (await page.getByTestId("invite-link").textContent())!;
  await shot(page, "invite");
  const ctx = await browser.newContext({ locale: "vi-VN" });
  const viewer = await ctx.newPage();
  await viewer.goto("/vi/sign-up");
  await viewer.locator('input[name="name"]').fill("Người xem");
  await viewer.locator('input[name="email"]').fill(viewerEmail);
  await viewer.locator('input[name="password"]').fill(TEST_PASSWORD);
  await viewer.locator('button[type="submit"]').click();
  await expect(viewer.getByRole("link", { name: "Tạo video" }).first()).toBeVisible();
  await viewer.goto(new URL(link).pathname);
  await viewer.getByTestId("accept-invite").click();
  await viewer.waitForURL((u) => !u.pathname.includes("/invite/"));
  await viewer.goto("/vi/workspace/members");
  await expect(viewer.getByTestId("members")).toContainText(ownerEmail);
  await expect(viewer.getByTestId("invite-form")).toHaveCount(0);
  const denied = await viewer.request.post("/api/projects", {
    data: {
      prompt: "Không được phép",
      aspect: "9:16",
      durationSec: 30,
      mode: "auto",
      voiceId: "vits:banmai",
    },
  });
  expect(denied.status()).toBe(403);
  expect(await denied.json()).toEqual({ error: "forbidden" });
  await ctx.close();

  // Platform admin: totals equal the sum of usage_records.
  const { db, close } = connect(process.env.DATABASE_URL, 2);
  try {
    await db.update(users).set({ isPlatformAdmin: true }).where(eq(users.email, ownerEmail));
    const [{ total }] = (await withAdmin(db, (tx) =>
      tx.select({ total: sql<string>`coalesce(sum(${usageRecords.costUsd}), 0)` }).from(usageRecords),
    )) as [{ total: string }];
    await page.goto("/vi/admin");
    await expect(page.getByTestId("admin-queues")).toContainText("render");
    const n = Number(total);
    await expect(page.getByTestId("admin-totals")).toContainText(`$${n.toFixed(n < 1 ? 4 : 2)}`);
    await shot(page, "admin");
  } finally {
    await close();
  }
});
