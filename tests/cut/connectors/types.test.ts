import { describe, it, expect } from "vitest";
import { resolveConnectorParams } from "../../../src/lib/cut/connectors/types";
import type { Joint } from "../../../src/types";

const j: Joint = { id: "j", position: [0, 0, 0], axis: [0, 0, 1], diameter: 6, length: 12, source: "auto" };

describe("resolveConnectorParams", () => {
  it("maps a Joint + preset to ConnectorParams (diameter->size, preset clearance)", () => {
    const p = resolveConnectorParams(j, "pla-tight");
    expect(p.size).toBe(6);
    expect(p.length).toBe(12);
    expect(p.clearance).toBe(0.10);
  });

  it("honors a per-joint clearance override", () => {
    expect(resolveConnectorParams({ ...j, clearance: 0.33 }, "pla-tight").clearance).toBe(0.33);
  });
});
