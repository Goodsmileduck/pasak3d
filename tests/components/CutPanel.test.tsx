import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CutPanel } from "../../src/components/CutPanel";
import type { CutPlaneSpec, Dowel, TolerancePreset } from "../../src/types";

const baseProps = {
  bboxMin: [-10, -10, -10] as [number, number, number],
  bboxMax: [10, 10, 10] as [number, number, number],
  axis: "z" as const,
  onAxisChange: vi.fn(),
  onPreviewChange: vi.fn<(plane: CutPlaneSpec, dowels: Dowel[], tolerance: TolerancePreset) => void>(),
  onCut: vi.fn<(plane: CutPlaneSpec, dowels: Dowel[], tolerance: TolerancePreset) => void>(),
  onCancel: vi.fn(),
  busy: false,
};

describe("CutPanel", () => {
  it("selecting a connector drives the underlying joint shape", async () => {
    // The connector picker is the sole shape driver now (the redundant Shape
    // select was removed); picking a keyed connector must set jointShape to match.
    const onShape = vi.fn();
    render(<CutPanel {...baseProps} connectorId="cylinder" onJointShapeChange={onShape} />);
    await userEvent.selectOptions(screen.getByLabelText(/connector/i), "dovetail");
    expect(onShape).toHaveBeenCalledWith("dovetail");
  });

  it("calls onJointPolarityChange when a polarity is selected", async () => {
    const onPolarity = vi.fn();
    render(<CutPanel {...baseProps} jointPolarity="separate-peg" onJointPolarityChange={onPolarity} />);
    await userEvent.selectOptions(screen.getByLabelText(/joint polarity/i), "magnet");
    expect(onPolarity).toHaveBeenCalledWith("magnet");
  });

  it("calls onConnectorChange when a connector is selected", async () => {
    const onConnector = vi.fn();
    render(<CutPanel {...baseProps} connectorId="cylinder" onConnectorChange={onConnector} />);
    await userEvent.selectOptions(screen.getByLabelText(/connector/i), "dovetail");
    expect(onConnector).toHaveBeenCalledWith("dovetail");
  });
});
