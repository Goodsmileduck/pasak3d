import { describe, it, expect } from "vitest";
import { resolveConnectorParams, type Connector } from "../../../src/lib/cut/connectors/types";
import type { Joint } from "../../../src/types";

const j: Joint = { id: "j", position: [0, 0, 0], axis: [0, 0, 1], diameter: 6, length: 12, source: "auto" };
const stub = (defaults: Connector["defaults"]): Connector => ({
  id: "stub", name: "Stub", category: "keyed", assembly: "separate-piece",
  defaults, describe: "", build: { femaleCavity: () => null, piece: () => null },
});

describe("resolveConnectorParams", () => {
  it("maps a Joint + preset to ConnectorParams (diameter->size, preset clearance)", () => {
    const p = resolveConnectorParams(j, stub({}), "pla-tight");
    expect(p.size).toBe(6);
    expect(p.length).toBe(12);
    expect(p.clearance).toBe(0.10); // no override, no connector default → preset
  });

  it("prefers the connector's default clearance over the preset", () => {
    expect(resolveConnectorParams(j, stub({ clearance: 0.25 }), "pla-tight").clearance).toBe(0.25);
  });

  it("honors a per-joint clearance override above the connector default and preset", () => {
    expect(resolveConnectorParams({ ...j, clearance: 0.33 }, stub({ clearance: 0.25 }), "pla-tight").clearance).toBe(0.33);
  });
});
