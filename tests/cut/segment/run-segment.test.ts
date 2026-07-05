import { beforeEach, describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { runSegment } from "../../../src/lib/cut/cut-client";

let lastReq: any = null;

class SegmentClientWorker {
  onmessage: ((e: MessageEvent) => void) | null = null;

  constructor(..._args: unknown[]) {}

  postMessage(req: any): void {
    lastReq = req;
    queueMicrotask(() => {
      this.onmessage?.({
        data: {
          reqId: req.reqId,
          ok: true,
          planes: [{ normal: [0, 0, 1], constant: 0, axisSnap: "free" }],
        },
      } as MessageEvent);
    });
  }

  terminate(): void {}
}

beforeEach(() => {
  lastReq = null;
  vi.stubGlobal("Worker", SegmentClientWorker);
});

describe("runSegment", () => {
  it("posts an op:segment request and resolves planes", async () => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    const planes = await runSegment(mesh, { maxParts: 8, detail: 0.45 });

    expect(lastReq.op).toBe("segment");
    expect(lastReq.opts).toEqual({ maxParts: 8, detail: 0.45 });
    expect(planes).toEqual([{ normal: [0, 0, 1], constant: 0, axisSnap: "free" }]);
  });
});
