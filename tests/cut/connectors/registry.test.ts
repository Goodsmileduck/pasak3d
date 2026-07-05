import { describe, it, expect } from "vitest";
import { getConnector, listByCategory, DEFAULT_CONNECTOR_ID } from "../../../src/lib/cut/connectors/registry";

describe("connector registry", () => {
  it("resolves the M1 keyed connectors by id", () => {
    expect(getConnector("cylinder")?.category).toBe("keyed");
    expect(getConnector("nope")).toBeUndefined();
    expect(getConnector(DEFAULT_CONNECTOR_ID)).toBeDefined();
  });

  it("lists keyed connectors (>= the 5 M1 shapes)", () => {
    expect(listByCategory("keyed").length).toBeGreaterThanOrEqual(5);
  });

  it("lists snap connectors after P2-M3", () => {
    const snap = listByCategory("snap").map((c) => c.id).sort();
    expect(snap).toEqual(["cantilever-clip", "snap-dovetail", "snap-pin"]);
  });
});
