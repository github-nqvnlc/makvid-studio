import { describe, expect, it } from "vitest";
import { migrate, MigrationError, SPEC_VERSION, type Migration } from "../src";

const chain: Migration[] = [
  { from: "0.0.1", to: "0.0.2", up: (s) => ({ ...s, renamed: s.old, old: undefined }) },
  { from: "0.0.2", to: "0.1.0", up: (s) => ({ ...s, added: true }) },
];

describe("migrate", () => {
  it("is a no-op for the current version", () => {
    const r = migrate({ specVersion: SPEC_VERSION, x: 1 });
    expect(r.applied).toEqual([]);
    expect(r.spec).toEqual({ specVersion: SPEC_VERSION, x: 1 });
  });

  it("chains migrations in order without mutating input", () => {
    const input = { specVersion: "0.0.1", old: "v" };
    const r = migrate(input, "0.1.0", chain);
    expect(r.applied).toEqual(["0.0.1->0.0.2", "0.0.2->0.1.0"]);
    expect(r.spec).toMatchObject({ specVersion: "0.1.0", renamed: "v", added: true });
    expect(input).toEqual({ specVersion: "0.0.1", old: "v" });
  });

  it("fails when no path exists", () => {
    expect(() => migrate({ specVersion: "9.9.9" }, "0.1.0", chain)).toThrow(MigrationError);
    expect(() => migrate({}, "0.1.0", chain)).toThrow(/specVersion missing/);
    expect(() => migrate([], "0.1.0", chain)).toThrow(/object/);
  });
});
