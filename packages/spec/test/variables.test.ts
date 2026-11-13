// T126: template variable extraction, substitution and table (CSV) validation.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  checkTable,
  extractVariables,
  parseVideoSpec,
  placeholdersIn,
  substituteVariables,
  templatize,
  type VideoSpec,
} from "../src";

const fixture = (): VideoSpec =>
  JSON.parse(readFileSync(new URL("../../../fixtures/specs/sample-vi.json", import.meta.url), "utf8"));

/** Sample spec turned into a template with two variables: ten_khach_hang and so_tien. */
function template(): VideoSpec {
  const s = fixture();
  s.script[0]!.text = "Chào {{ten_khach_hang}}, bạn có biết tiền có thể tự đẻ ra tiền?";
  s.scenes[0]!.slots.headline = "{{ten_khach_hang}} ơi, tiền tự đẻ ra tiền?";
  s.scenes[1]!.slots.subtitle = { var: "so_tien" };
  s.variables = { so_tien: { type: "number" } };
  return s;
}

describe("template variables", () => {
  it("finds placeholders (case-insensitive, spaces allowed, deduplicated)", () => {
    expect(placeholdersIn("A {{ Ten }} b {{ten}} {{so_tien}} {{}} {x}")).toEqual(["ten", "so_tien"]);
  });

  it("extracts variables with type and the room left in the tightest slot", () => {
    const vars = extractVariables(template(), (i, slot) => (i === 0 && slot === "headline" ? 40 : undefined));
    expect(vars).toEqual([
      // "{{ten_khach_hang}} ơi, tiền tự đẻ ra tiền?" has 24 fixed characters -> 40 - 24 = 16
      { name: "ten_khach_hang", type: "text", required: true, maxLength: 16 },
      { name: "so_tien", type: "number", required: true, maxLength: 80 },
    ]);
  });

  it("substitutes one row: narration, text slots, {var} slots (number), declared values; drops old narration", () => {
    const t = template();
    t.audio.narration = { assetKey: "x", words: [] };
    const out = substituteVariables(t, { ten_khach_hang: "Chị Hoà", so_tien: "1500000" });
    expect(out.script[0]!.text).toBe("Chào Chị Hoà, bạn có biết tiền có thể tự đẻ ra tiền?");
    expect(out.scenes[0]!.slots.headline).toBe("Chị Hoà ơi, tiền tự đẻ ra tiền?");
    expect(out.scenes[1]!.slots.subtitle).toBe(1500000);
    expect(out.variables.so_tien).toEqual({ type: "number", value: "1500000" });
    expect(out.audio.narration).toBeUndefined();
    expect(JSON.stringify(out)).not.toMatch(/\{\{/);
    expect(parseVideoSpec(out).ok).toBe(true);
    // the template itself is untouched
    expect(t.script[0]!.text).toContain("{{ten_khach_hang}}");
  });

  it("values are NFC-normalized; a missing value throws", () => {
    const out = substituteVariables(template(), { ten_khach_hang: "Hoà".normalize("NFD"), so_tien: "5" });
    expect(out.script[0]!.text).toContain("Hoà".normalize("NFC"));
    expect(parseVideoSpec(out).ok).toBe(true);
    expect(() => substituteVariables(template(), { ten_khach_hang: "A" })).toThrow(/so_tien/);
  });

  it("templatize replaces a phrase everywhere and validates names", () => {
    const t = templatize(fixture(), [{ find: "lãi kép", name: "chu_de" }]);
    expect(t.script[1]!.text).toBe("Đó chính là sức mạnh của {{chu_de}}.");
    expect(extractVariables(t).map((v) => v.name)).toEqual(["chu_de"]);
    expect(() => templatize(fixture(), [{ find: "x", name: "Tên Khách" }])).toThrow(/invalid variable name/);
  });
});

describe("table check (CSV against template)", () => {
  const vars = extractVariables(template(), () => 40);

  it("reports missing required columns before anything runs", () => {
    const r = checkTable(
      [
        ["Ten_Khach_Hang", "ghi_chu"],
        ["An", "x"],
      ],
      vars,
    );
    expect(r.missingColumns).toEqual(["so_tien"]);
    expect(r.extraColumns).toEqual(["ghi_chu"]);
  });

  it("validates rows: required, max length, numbers in Vietnamese/English formats", () => {
    const long = "Nguyễn Văn Một Hai Ba Bốn Năm";
    const r = checkTable(
      [
        ["ten_khach_hang", "so_tien"],
        ["An", "1.500.000"],
        ["", "12"],
        [long, "1,234.5"],
        ["Bình", "mười"],
        ["Chi", "1 000"],
      ],
      vars,
    );
    expect(r.missingColumns).toEqual([]);
    expect(r.issues).toEqual([
      { row: 2, column: "ten_khach_hang", code: "required" },
      { row: 3, column: "ten_khach_hang", code: "too_long", maxLength: vars[0]!.maxLength },
      { row: 4, column: "so_tien", code: "not_a_number" },
    ]);
    expect(r.rows[0]).toEqual({ ten_khach_hang: "An", so_tien: "1.500.000" });
  });
});
