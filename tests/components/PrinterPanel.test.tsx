import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PrinterPanel } from "../../src/components/PrinterPanel";
import { PRINTER_PRESETS } from "../../src/lib/printer-presets";

describe("PrinterPanel", () => {
  it("renders an <option> for every preset printer", () => {
    render(<PrinterPanel selected={null} onChange={vi.fn()} />);
    const options = screen.getAllByRole("option");
    // PRINTER_PRESETS + the leading "No printer" option
    expect(options.length).toBe(PRINTER_PRESETS.length + 1);
  });

  it("includes a 'No printer' option", () => {
    render(<PrinterPanel selected={null} onChange={vi.fn()} />);
    expect(screen.getByRole("option", { name: "No printer" })).toBeInTheDocument();
  });

  it("emits the selected printer on change", () => {
    const onChange = vi.fn();
    render(<PrinterPanel selected={null} onChange={onChange} />);
    const select = screen.getByRole("combobox");
    fireEvent.change(select, { target: { value: "bambu-a1" } });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ id: "bambu-a1", name: "Bambu Lab A1" }),
    );
  });

  it("emits null when 'No printer' is selected", () => {
    const onChange = vi.fn();
    const printer = PRINTER_PRESETS[0];
    render(<PrinterPanel selected={printer} onChange={onChange} />);
    const select = screen.getByRole("combobox");
    fireEvent.change(select, { target: { value: "" } });
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("reflects the current selection in the dropdown", () => {
    const printer = PRINTER_PRESETS.find((p) => p.id === "prusa-mk4")!;
    render(<PrinterPanel selected={printer} onChange={vi.fn()} />);
    expect((screen.getByRole("combobox") as HTMLSelectElement).value).toBe("prusa-mk4");
  });
});
