import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HelpOverlay } from "../../src/components/HelpOverlay";

describe("HelpOverlay", () => {
  it("renders the shortcut table", () => {
    render(<HelpOverlay onClose={vi.fn()} />);
    expect(screen.getByText("Keyboard Shortcuts")).toBeInTheDocument();
    expect(screen.getByText("X / Y / Z")).toBeInTheDocument();
    expect(screen.getByText("Ctrl+Z")).toBeInTheDocument();
    expect(screen.getByText("Open file")).toBeInTheDocument();
  });

  it("calls onClose when the Close button is clicked", async () => {
    const onClose = vi.fn();
    render(<HelpOverlay onClose={onClose} />);
    await userEvent.setup().click(screen.getByRole("button", { name: /close/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when the backdrop is clicked", async () => {
    const onClose = vi.fn();
    const { container } = render(<HelpOverlay onClose={onClose} />);
    const backdrop = container.firstChild as HTMLElement;
    await userEvent.setup().click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does NOT call onClose when the inner panel is clicked", async () => {
    const onClose = vi.fn();
    render(<HelpOverlay onClose={onClose} />);
    // Click inside the panel (the heading is inside)
    await userEvent.setup().click(screen.getByText("Keyboard Shortcuts"));
    expect(onClose).not.toHaveBeenCalled();
  });
});
