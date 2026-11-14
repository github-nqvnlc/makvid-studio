// Filter parsing for GET /api/projects and the delete-by-filter body: bounds, groups, bad input.
import { describe, expect, it } from "vitest";
import {
  activeFilterCount,
  expandStatuses,
  fromSearchParams,
  groupOf,
  parseListQuery,
  toSearchParams,
} from "../src/lib/project-query";

const parse = (qs: string) => parseListQuery(new URLSearchParams(qs));

describe("parseListQuery", () => {
  it("defaults: newest first, page 1, 24 per page, Vietnam time zone", () => {
    const r = parse("");
    expect(r.success && r.data).toMatchObject({ sort: "updated", page: 1, pageSize: 24, tz: "Asia/Ho_Chi_Minh" });
  });
  it("reads csv filters and ranges", () => {
    const r = parse(
      "status=failed,processing&aspect=9:16,1:1&source=url&mode=review&created=custom&createdFrom=2026-11-01&createdTo=2026-11-14&q= dong ho ",
    );
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.status).toEqual(["failed", "processing"]);
      expect(r.data.aspect).toEqual(["9:16", "1:1"]);
      expect(r.data.q).toBe("dong ho");
    }
  });
  it.each([
    ["pageSize=0"],
    ["pageSize=101"],
    ["page=0"],
    ["status=nope"],
    ["aspect=3:2"],
    ["mode=fast"],
    ["createdBy=abc"],
    ["createdFrom=14/11/2026&created=custom"],
    ["tz=Mars/Base"],
    ["sort=random"],
    [`q=${"x".repeat(201)}`],
  ])("rejects %s instead of ignoring it", (qs) => {
    expect(parse(qs).success).toBe(false);
  });
});

describe("status groups", () => {
  it("expands groups and raw statuses", () => {
    expect(expandStatuses(["review"]).sort()).toEqual(["awaiting_script_review", "awaiting_storyboard_review"]);
    expect(expandStatuses(["ready", "qa"]).sort()).toEqual(["qa", "ready"]);
    expect(groupOf("rendering")).toBe("processing");
    expect(groupOf("needs_attention")).toBe("attention");
  });
});

describe("URL state", () => {
  it("round-trips and omits defaults", () => {
    const f = { q: "đồng hồ", status: ["failed"], created: "7d", page: 3 };
    const p = toSearchParams(f);
    expect(p.toString()).not.toContain("pageSize");
    expect(fromSearchParams(p)).toMatchObject(f);
    expect(activeFilterCount(f)).toBe(2);
  });
});
