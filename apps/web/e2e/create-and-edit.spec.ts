// T092: sign up -> create -> 3 chat edits -> download, as a non-technical user would.
import { expect, test } from "@playwright/test";
import { createVideo, signUp, waitReady } from "./helpers";

test("sign up, create a video, edit it three times by chat, download it", async ({ page }) => {
  await signUp(page, "create");
  await createVideo(page, "Giải thích lãi kép cho người mới đi làm");
  await waitReady(page);
  await expect(page.getByTestId("preview-video")).toBeVisible();

  const edits = [
    "Đổi tiêu đề thành: Lãi kép thần kỳ",
    "Đổi chữ cảnh 1 thành: Tiền đẻ ra tiền",
    "Đổi phong cách sang kinetic",
  ];
  for (const [i, text] of edits.entries()) {
    await page.locator('textarea[name="message"]').fill(text);
    await page.getByRole("button", { name: "Gửi" }).click();
    await expect(page.getByTestId("chat-log").locator(".bubble.assistant")).toHaveCount(i + 1);
    await waitReady(page);
  }
  await expect(page.getByTestId("versions").getByText(/^Phiên bản \d+$/)).toHaveCount(4);

  const href = await page
    .getByTestId("downloads")
    .getByRole("link", { name: /Video 9:16/ })
    .getAttribute("href");
  expect(href).toBeTruthy();
  const res = await page.request.get(href!);
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toBe("video/mp4");
  expect((await res.body()).byteLength).toBeGreaterThan(1000);
  const srt = await page
    .getByTestId("downloads")
    .getByRole("link", { name: /Phụ đề/ })
    .getAttribute("href");
  expect((await (await page.request.get(srt!)).text()).length).toBeGreaterThan(20);
});
