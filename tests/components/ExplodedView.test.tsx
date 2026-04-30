import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { fireEvent } from "@testing-library/react";
import { ExplodedView } from "../../src/components/ExplodedView";

describe("ExplodedView", () => {
  it("renders the percent label rounded to nearest integer", () => {
    render(<ExplodedView value={0.4} onChange={vi.fn()} />);
    expect(screen.getByText("40%")).toBeInTheDocument();
  });

  it("emits the new value on slider change", () => {
    const onChange = vi.fn();
    render(<ExplodedView value={0} onChange={onChange} />);
    const slider = screen.getByRole("slider");
    fireEvent.change(slider, { target: { value: "0.5" } });
    expect(onChange).toHaveBeenCalledWith(0.5);
  });

  it("clamps the slider range to 0..1", () => {
    render(<ExplodedView value={0} onChange={vi.fn()} />);
    const slider = screen.getByRole("slider");
    expect(slider).toHaveAttribute("min", "0");
    expect(slider).toHaveAttribute("max", "1");
  });
});
