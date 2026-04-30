import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Toolbar } from "../../src/components/Toolbar";

describe("Toolbar", () => {
  it("renders Open and Export buttons", () => {
    render(<Toolbar onOpen={vi.fn()} onExport={vi.fn()} canExport={false} />);
    expect(screen.getByRole("button", { name: /open/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^export$/i })).toBeInTheDocument();
  });

  it("calls onOpen when Open is clicked", async () => {
    const onOpen = vi.fn();
    render(<Toolbar onOpen={onOpen} onExport={vi.fn()} canExport={false} />);
    await userEvent.setup().click(screen.getByRole("button", { name: /open/i }));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("disables the Export button when canExport is false", () => {
    render(<Toolbar onOpen={vi.fn()} onExport={vi.fn()} canExport={false} />);
    expect(screen.getByRole("button", { name: /^export$/i })).toBeDisabled();
  });

  it("enables the Export button when canExport is true", () => {
    render(<Toolbar onOpen={vi.fn()} onExport={vi.fn()} canExport={true} />);
    expect(screen.getByRole("button", { name: /^export$/i })).toBeEnabled();
  });

  it("calls onExport when Export is clicked", async () => {
    const onExport = vi.fn();
    render(<Toolbar onOpen={vi.fn()} onExport={onExport} canExport={true} />);
    await userEvent.setup().click(screen.getByRole("button", { name: /^export$/i }));
    expect(onExport).toHaveBeenCalledTimes(1);
  });

  it("disables Undo/Redo when canUndo/canRedo are false", () => {
    render(
      <Toolbar
        onOpen={vi.fn()}
        onExport={vi.fn()}
        canExport={false}
        onUndo={vi.fn()}
        onRedo={vi.fn()}
        canUndo={false}
        canRedo={false}
      />,
    );
    expect(screen.getByRole("button", { name: /undo/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /redo/i })).toBeDisabled();
  });

  it("enables Undo and triggers callback", async () => {
    const onUndo = vi.fn();
    render(
      <Toolbar
        onOpen={vi.fn()}
        onExport={vi.fn()}
        canExport={false}
        onUndo={onUndo}
        canUndo={true}
      />,
    );
    const undoBtn = screen.getByRole("button", { name: /undo/i });
    expect(undoBtn).toBeEnabled();
    await userEvent.setup().click(undoBtn);
    expect(onUndo).toHaveBeenCalledTimes(1);
  });

  it("renders the printerSlot when provided", () => {
    render(
      <Toolbar
        onOpen={vi.fn()}
        onExport={vi.fn()}
        canExport={false}
        printerSlot={<span data-testid="my-slot">Slotted</span>}
      />,
    );
    expect(screen.getByTestId("my-slot")).toBeInTheDocument();
  });
});
