import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ExportDialog } from "../../src/components/ExportDialog";

describe("ExportDialog", () => {
  it("renders with the supplied default filename", () => {
    render(
      <ExportDialog defaultFilename="cube-pasak" onCancel={vi.fn()} onConfirm={vi.fn()} />,
    );
    expect(screen.getByDisplayValue("cube-pasak")).toBeInTheDocument();
  });

  it("defaults to zip-stl, includeDowels=true, autoOrient=true", async () => {
    const onConfirm = vi.fn();
    render(
      <ExportDialog defaultFilename="x" onCancel={vi.fn()} onConfirm={onConfirm} />,
    );
    await userEvent.setup().click(screen.getByRole("button", { name: /^export$/i }));
    expect(onConfirm).toHaveBeenCalledWith({
      format: "zip-stl",
      includeDowels: true,
      autoOrient: true,
      filename: "x",
    });
  });

  it("emits autoOrient=false when the checkbox is unticked", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <ExportDialog defaultFilename="x" onCancel={vi.fn()} onConfirm={onConfirm} />,
    );
    await user.click(screen.getByLabelText(/auto-orient/i));
    await user.click(screen.getByRole("button", { name: /^export$/i }));
    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ autoOrient: false }));
  });

  it("emits the chosen format when changed to 3mf", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <ExportDialog defaultFilename="x" onCancel={vi.fn()} onConfirm={onConfirm} />,
    );
    await user.selectOptions(screen.getByRole("combobox"), "3mf");
    await user.click(screen.getByRole("button", { name: /^export$/i }));
    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ format: "3mf" }));
  });

  it("respects unticking the 'Include dowels' checkbox", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <ExportDialog defaultFilename="x" onCancel={vi.fn()} onConfirm={onConfirm} />,
    );
    await user.click(screen.getByLabelText(/include dowels/i));
    await user.click(screen.getByRole("button", { name: /^export$/i }));
    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ includeDowels: false }));
  });

  it("emits the user-edited filename", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <ExportDialog defaultFilename="x" onCancel={vi.fn()} onConfirm={onConfirm} />,
    );
    const input = screen.getByDisplayValue("x");
    await user.clear(input);
    await user.type(input, "my-export");
    await user.click(screen.getByRole("button", { name: /^export$/i }));
    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ filename: "my-export" }));
  });

  it("calls onCancel when Cancel is clicked", async () => {
    const onCancel = vi.fn();
    render(
      <ExportDialog defaultFilename="x" onCancel={onCancel} onConfirm={vi.fn()} />,
    );
    await userEvent.setup().click(screen.getByRole("button", { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
