import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as THREE from "three";
import { StatusBar } from "../../src/components/StatusBar";

const info = {
  filename: "part.stl",
  format: "stl" as const,
  fileSize: 1234,
  triCount: 12,
  bbox: { min: [0, 0, 0] as [number, number, number], max: [10, 10, 10] as [number, number, number] },
  dimensions: { x: 10, y: 10, z: 10 },
};

describe("StatusBar", () => {
  it("calls onAutoSplit when Auto-Split is clicked", async () => {
    const onAutoSplit = vi.fn();
    const group = new THREE.Group();
    group.add(new THREE.Mesh(new THREE.BoxGeometry(10, 10, 10)));

    render(
      <StatusBar
        info={info}
        error={null}
        isLoading={false}
        parts={[{ visible: true, isDowel: false, group }]}
        printer={{ id: "large", name: "Large Printer", buildVolume: { x: 100, y: 100, z: 100 } }}
        onAutoSplit={onAutoSplit}
      />,
    );

    await userEvent.setup().click(screen.getByRole("button", { name: /auto-split/i }));
    expect(onAutoSplit).toHaveBeenCalledTimes(1);
  });

  it("calls onAutoSplit when no printer is set", async () => {
    const onAutoSplit = vi.fn();
    const group = new THREE.Group();
    group.add(new THREE.Mesh(new THREE.BoxGeometry(10, 10, 10)));

    render(
      <StatusBar
        info={info}
        error={null}
        isLoading={false}
        parts={[{ visible: true, isDowel: false, group }]}
        printer={null}
        onAutoSplit={onAutoSplit}
      />,
    );

    await userEvent.setup().click(screen.getByRole("button", { name: /auto-split/i }));
    expect(onAutoSplit).toHaveBeenCalledTimes(1);
  });
});
