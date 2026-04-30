import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as THREE from "three";
import { PartsTree } from "../../src/components/PartsTree";
import type { RuntimePart } from "../../src/lib/session";

function makePart(opts: {
  id: string;
  name: string;
  parentId?: string | null;
  cutId?: string | null;
  visible?: boolean;
  isDowel?: boolean;
  triCount?: number;
}): RuntimePart {
  return {
    id: opts.id,
    isDowel: opts.isDowel ?? false,
    mesh: new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1)),
    group: new THREE.Group(),
    meta: {
      id: opts.id,
      name: opts.name,
      source: opts.parentId ? "cut" : "import",
      parentId: opts.parentId ?? null,
      cutId: opts.cutId ?? null,
      visible: opts.visible ?? true,
      color: "#3b82f6",
      triCount: opts.triCount ?? 12,
    },
  };
}

describe("PartsTree", () => {
  it("renders nothing for an empty parts list (just the headers)", () => {
    render(<PartsTree parts={[]} selectedId={null} onSelect={vi.fn()} onToggleVisible={vi.fn()} />);
    expect(screen.getByText("Parts")).toBeInTheDocument();
    expect(screen.queryByText("Dowels")).not.toBeInTheDocument();
  });

  it("renders the root part by name", () => {
    const parts = [makePart({ id: "p_root", name: "Body" })];
    render(<PartsTree parts={parts} selectedId={null} onSelect={vi.fn()} onToggleVisible={vi.fn()} />);
    expect(screen.getByText("Body")).toBeInTheDocument();
  });

  it("renders a parent → child hierarchy", () => {
    const parts = [
      makePart({ id: "p_root", name: "Body", visible: false }),
      makePart({ id: "p_root_a", name: "Body-A", parentId: "p_root", cutId: "c1" }),
      makePart({ id: "p_root_b", name: "Body-B", parentId: "p_root", cutId: "c1" }),
    ];
    render(<PartsTree parts={parts} selectedId={null} onSelect={vi.fn()} onToggleVisible={vi.fn()} />);
    expect(screen.getByText("Body")).toBeInTheDocument();
    expect(screen.getByText("Body-A")).toBeInTheDocument();
    expect(screen.getByText("Body-B")).toBeInTheDocument();
  });

  it("calls onSelect when a part row is clicked", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const parts = [makePart({ id: "p_root", name: "Body" })];
    render(<PartsTree parts={parts} selectedId={null} onSelect={onSelect} onToggleVisible={vi.fn()} />);
    await user.click(screen.getByText("Body"));
    expect(onSelect).toHaveBeenCalledWith("p_root");
  });

  it("calls onToggleVisible when the visibility checkbox is toggled", async () => {
    const user = userEvent.setup();
    const onToggleVisible = vi.fn();
    const parts = [makePart({ id: "p_root", name: "Body", visible: true })];
    render(<PartsTree parts={parts} selectedId={null} onSelect={vi.fn()} onToggleVisible={onToggleVisible} />);
    const checkbox = screen.getAllByRole("checkbox")[0];
    await user.click(checkbox);
    expect(onToggleVisible).toHaveBeenCalledWith("p_root", false);
  });

  it("does not propagate the visibility-checkbox click as a row select", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const parts = [makePart({ id: "p_root", name: "Body" })];
    render(<PartsTree parts={parts} selectedId={null} onSelect={onSelect} onToggleVisible={vi.fn()} />);
    const checkbox = screen.getAllByRole("checkbox")[0];
    await user.click(checkbox);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("renders the Dowels section only when dowels are present", () => {
    const parts = [
      makePart({ id: "p_root", name: "Body", visible: false }),
      makePart({ id: "p_root_a", name: "Body-A", parentId: "p_root", cutId: "c1" }),
      makePart({ id: "c1_d0", name: "Dowel c1-1", isDowel: true, cutId: "c1" }),
      makePart({ id: "c1_d1", name: "Dowel c1-2", isDowel: true, cutId: "c1" }),
    ];
    render(<PartsTree parts={parts} selectedId={null} onSelect={vi.fn()} onToggleVisible={vi.fn()} />);
    expect(screen.getByText("Dowels (2)")).toBeInTheDocument();
    expect(screen.getByText("Dowel c1-1")).toBeInTheDocument();
  });

  it("highlights the selected part visually", () => {
    const parts = [makePart({ id: "p_root", name: "Body" })];
    const { container } = render(
      <PartsTree parts={parts} selectedId="p_root" onSelect={vi.fn()} onToggleVisible={vi.fn()} />,
    );
    expect(container.querySelector(".bg-blue-100")).toBeInTheDocument();
  });

  it("shows the triangle count", () => {
    const parts = [makePart({ id: "p_root", name: "Body", triCount: 24318 })];
    render(<PartsTree parts={parts} selectedId={null} onSelect={vi.fn()} onToggleVisible={vi.fn()} />);
    expect(screen.getByText("24318")).toBeInTheDocument();
  });
});
