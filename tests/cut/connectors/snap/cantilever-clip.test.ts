import { it, expect, beforeAll } from "vitest";
import { initManifold } from "../../../../src/lib/cut/manifold";
import { cantileverClipConnector } from "../../../../src/lib/cut/connectors/snap/cantilever-clip";

let M: any;
beforeAll(async () => { M = await initManifold(); });
const p = { size: 8, length: 14, clearance: 0.2 };

it("cantilever clip is integral: has integralMale, no piece", () => {
  expect(cantileverClipConnector.assembly).toBe("integral");
  const male = cantileverClipConnector.build.integralMale!(M, p);
  expect(male).not.toBeNull();
  expect(male.status()).toBe("NoError");
  expect(cantileverClipConnector.build.piece(M, p)).toBeNull();
  male.delete();
});
