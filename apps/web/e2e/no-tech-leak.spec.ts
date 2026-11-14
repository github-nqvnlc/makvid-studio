// T093: no user page shows technical strings (code, markup, stack traces, JSON, tool or provider names).
import { expect, test, type Page } from "@playwright/test";
import { createVideo, signUp, waitReady } from "./helpers";

const FORBIDDEN: RegExp[] = [
  /[{}]/,
  /<\/?(div|span|script)\b/i,
  /\bError:/,
  /\bat \S+ \(.*:\d+:\d+\)/,
  /\b(undefined|NaN|null)\b/,
  /HyperFrames|GSAP|FFmpeg|Puppeteer|Chrome|BullMQ|Postgres|Drizzle|Next\.js|FPT|Soundstripe|OpenAI|Gemini|gemma|DeepSeek/i,
  /"[a-zA-Z_]+":/,
];

async function expectClean(page: Page, where: string) {
  const text = await page.locator("body").innerText();
  for (const re of FORBIDDEN) expect(text, `${where} shows ${re}`).not.toMatch(re);
}

test("user pages never show technical information", async ({ page }) => {
  await page.goto("/vi");
  await expectClean(page, "landing");
  await page.goto("/vi/sign-in");
  await expectClean(page, "sign-in");
  await page.goto("/en/sign-up");
  await expectClean(page, "sign-up (en)");

  await signUp(page, "leak");
  await expectClean(page, "projects (empty)");
  await page.goto("/vi/projects/new");
  await expectClean(page, "create");

  // Review mode: both review screens.
  await createVideo(page, "Ba mẹo tiết kiệm tiền mỗi tháng", "review");
  await expect(page.getByTestId("script-review")).toBeVisible({ timeout: 120_000 });
  await expectClean(page, "script review");
  await page.getByRole("button", { name: "Tiếp tục" }).click();
  await expect(page.getByTestId("storyboard-review")).toBeVisible({ timeout: 120_000 });
  await expectClean(page, "storyboard review");
  await page.getByRole("button", { name: "Tạo video" }).last().click();
  await waitReady(page);
  await expectClean(page, "editor");

  // Friendly error and a clarifying question, still without technical text.
  await page.locator('textarea[name="message"]').fill("Làm cho đẹp hơn");
  await page.getByRole("button", { name: "Gửi" }).click();
  await expect(page.getByTestId("chat-log").locator(".bubble.assistant")).toHaveCount(1);
  await expectClean(page, "editor after a clarifying question");
  const id = page.url().split("/").pop();
  const res = await page.request.post(`/api/projects/${id}/actions`, { data: { action: "redo" } });
  expect(await res.json()).toEqual({ error: "nothing_to_redo" }); // a code, never a message or stack
  await page.goto("/vi/projects/00000000-0000-4000-8000-000000000000");
  await expect(page.getByText("Không tìm thấy dự án này.")).toBeVisible();
  await expectClean(page, "missing project");
  await page.goto("/en");
  await expectClean(page, "projects (en)");

  // Every other page of the new UI, in both languages (UI-G4).
  for (const path of ["/pricing", "/account", "/workspace/billing", "/workspace/members", "/workspace/brand", "/workspace/assets", "/workspace/api", "/batches", "/khong-co-trang"]) {
    for (const prefix of ["/vi", "/en"]) {
      await page.goto(`${prefix}${path}`);
      await expectClean(page, `${prefix}${path}`);
    }
  }
});
