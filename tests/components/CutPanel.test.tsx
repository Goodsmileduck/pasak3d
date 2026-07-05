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

  it("calls onConnectorTestFit when the test-fit button is clicked", async () => {
    const onTestFit = vi.fn();
    render(<CutPanel {...baseProps} connectorId="snap-pin" onConnectorTestFit={onTestFit} />);
    await userEvent.click(screen.getByRole("button", { name: /test.?fit/i }));
    expect(onTestFit).toHaveBeenCalled();
  });

  it("hides the polarity control for non-M1 connectors (it has no effect there)", async () => {
    render(<CutPanel {...baseProps} connectorId="cylinder" />);
    expect(screen.queryByLabelText(/joint polarity/i)).not.toBeNull(); // M1 shape → shown
    await userEvent.click(screen.getByRole("button", { name: /^snap$/i }));
    expect(screen.queryByLabelText(/joint polarity/i)).toBeNull();     // snap connector → hidden
  });

  it("switching category resyncs the connector so App state matches the display", async () => {
    // A keyed connector is selected; switching to Snap must adopt the first snap
    // connector (else Cut/Test-fit would act on the stale keyed id shown by App).
    const onConnector = vi.fn();
    render(<CutPanel {...baseProps} connectorId="cylinder" onConnectorChange={onConnector} />);
    await userEvent.click(screen.getByRole("button", { name: /^snap$/i }));
    expect(onConnector).toHaveBeenCalledWith("snap-pin");
  });
});
