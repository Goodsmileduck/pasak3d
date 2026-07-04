import { describe, it, expect } from "vitest";
import { resolveClearance, TOLERANCE_VALUES, type Joint } from "../src/types";

describe("Joint type + resolveClearance", () => {
  const base: Joint = {
    id: "j1", position: [0, 0, 0], axis: [0, 0, 1],
    diameter: 5, length: 20, source: "auto",
  };

  it("defaults clearance to the preset value when no override", () => {
    expect(resolveClearance(base, "pla-tight")).toBe(TOLERANCE_VALUES["pla-tight"]);
  });

  it("uses the per-joint clearance override when present", () => {
    expect(resolveClearance({ ...base, clearance: 0.33 }, "pla-tight")).toBe(0.33);
  });

  it("treats a legacy dowel (no shape/polarity) as a cylinder separate-peg", () => {
    // Type-level: assignable without shape/polarity; runtime defaults live in shapes/apply.
    const legacy: Joint = base;
    expect(legacy.shape ?? "cylinder").toBe("cylinder");
    expect(legacy.polarity ?? "separate-peg").toBe("separate-peg");
  });
});
