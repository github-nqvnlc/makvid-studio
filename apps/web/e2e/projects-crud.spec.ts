// UI-G3 (spec 002 US5): search without accents, filters in the URL, rename, delete one / many / all matching.
// Projects are seeded straight into the database (a pipeline run per project would take minutes).
import { expect, test } from "@playwright/test";
import postgres from "postgres";
import { signUp } from "./helpers";

try {
  process.loadEnvFile(new URL("../../../.env", import.meta.url));
} catch {
  /* DATABASE_URL may come from the environment */
}

test("manage projects: search, filter, rename, delete selected and delete all matching", async ({ page }) => {
  test.setTimeout(240_000);
  const email = await signUp(page, "projects");
  const sql = postgres(process.env.DATABASE_URL ?? "postgres://makvid:makvid-dev@localhost:5432/makvid", { max: 1 });
  try {
    const [m] = await sql<{ workspace_id: string; user_id: string }[]>`
      SELECT m.workspace_id, m.user_id FROM memberships m JOIN users u ON u.id = m.user_id WHERE u.email = ${email}`;
    for (let i = 0; i < 30; i++) {
      const title = i < 3 ? `Đồng Hồ Số ${i}` : `Video số ${i}`;
      await sql`INSERT INTO projects (workspace_id, title, status, primary_aspect, created_by)
        VALUES (${m!.workspace_id}, ${title}, ${i >= 3 && i < 8 ? "failed" : "ready"}, ${i % 2 ? "9:16" : "16:9"}, ${m!.user_id})`;
    }

    await page.goto("/");
    await expect(page.getByTestId("pager-info")).toHaveText("1–24 trên 30");

    // Search ignores accents and case, and lives in the URL.
    await page.getByTestId("project-search").fill("dong ho");
    await expect(page.getByTestId("pager-info")).toHaveText("1–3 trên 3");
    expect(page.url()).toContain("q=dong+ho");
    await page.reload();
    await expect(page.getByTestId("pager-info")).toHaveText("1–3 trên 3");

    // Rename from the row menu.
    await page.getByRole("button", { name: /Thao tác với Đồng Hồ Số 0/ }).click();
    await page.getByRole("menuitem", { name: "Đổi tên" }).click();
    await page.getByTestId("rename-input").fill("Đồng hồ đổi tên");
    await page.getByTestId("rename-save").click();
    await expect(page.getByText("Đồng hồ đổi tên")).toBeVisible();

    // Filter by status group; survives a reload.
    await page.goto("/?status=failed");
    await expect(page.getByTestId("pager-info")).toHaveText("1–5 trên 5");
    await page.reload();
    await expect(page.getByTestId("pager-info")).toHaveText("1–5 trên 5");

    // Delete two selected projects (typed phrase required).
    await page.getByRole("checkbox", { name: /Chọn Video số 3/ }).click();
    await page.getByRole("checkbox", { name: /Chọn Video số 4/ }).click();
    await page.getByTestId("delete-selected").click();
    await expect(page.getByTestId("delete-confirm")).toBeDisabled();
    await page.getByTestId("delete-phrase").fill("XOA");
    await page.getByTestId("delete-confirm").click();
    await expect(page.getByText("Đã xóa 2 dự án.")).toBeVisible();
    await expect(page.getByTestId("pager-info")).toHaveText("1–3 trên 3");

    // Delete every project that matches a filter, across pages; others stay.
    await page.goto("/?status=ready&pageSize=12");
    await expect(page.getByTestId("pager-info")).toHaveText("1–12 trên 25");
    await page.getByRole("radio", { name: "Bảng" }).click();
    await page.getByTestId("select-page").click();
    await page.getByTestId("select-all-matching").click();
    await page.getByTestId("delete-selected").click();
    await page.getByTestId("delete-phrase").fill("XOA");
    await page.getByTestId("delete-confirm").click();
    await expect(page.getByText("Đã xóa 25 dự án.")).toBeVisible();

    await page.goto("/");
    await expect(page.getByTestId("pager-info")).toHaveText("1–3 trên 3");

    // The rows really are gone, not just hidden.
    await expect
      .poll(async () => (await sql`SELECT count(*)::int AS n FROM projects WHERE workspace_id = ${m!.workspace_id}`)[0]!.n, {
        timeout: 150_000,
      })
      .toBe(3);
  } finally {
    await sql.end();
  }
});
