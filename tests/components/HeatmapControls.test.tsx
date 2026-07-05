import { it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { HeatmapControls } from "../../src/components/HeatmapControls";

it("reports threshold changes", () => {
  const onChange = vi.fn();
  render(<HeatmapControls threshold={45} onThresholdChange={onChange} />);
  fireEvent.change(screen.getByLabelText(/overhang threshold/i), { target: { value: "30" } });
  expect(onChange).toHaveBeenCalledWith(30);
});
