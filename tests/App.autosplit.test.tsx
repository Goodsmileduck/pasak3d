import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as THREE from "three";
import type { ModelData } from "../src/types";

const mocks = vi.hoisted(() => ({
  loadModel: vi.fn(),
  runSegment: vi.fn(),
}));

vi.mock("../src/lib/loaders", async () => {
  const actual = await vi.importActual<typeof import("../src/lib/loaders")>("../src/lib/loaders");
  return {
    ...actual,
    loadModel: mocks.loadModel,
  };
});

vi.mock("../src/lib/cut/cut-client", () => ({
  runSegment: mocks.runSegment,
  runCut: vi.fn(),
  runSeparate: vi.fn(),
  runLabel: vi.fn(),
  runConnectorTestFit: vi.fn(),
}));

vi.mock("../src/lib/platform", async () => {
  const actual = await vi.importActual<typeof import("../src/lib/platform")>("../src/lib/platform");
  return {
    ...actual,
    isDesktop: false,
  };
});

vi.mock("../src/components/DropZone", () => ({
  DropZone: ({ onFile, children }: { onFile: (file: File) => void; children: React.ReactNode }) => (
    <div>
      <button onClick={() => onFile(new File(["solid"], "part.stl"))}>Load model</button>
      {children}
    </div>
  ),
}));

vi.mock("../src/components/Viewer", () => ({
  Viewer: () => <div data-testid="viewer" />,
}));

vi.mock("../src/components/PrinterPanel", () => ({
  PrinterPanel: ({ onChange }: { onChange: (printer: { id: string; name: string; buildVolume: { x: number; y: number; z: number } }) => void }) => (
    <button onClick={() => onChange({ id: "large", name: "Large Printer", buildVolume: { x: 100, y: 100, z: 100 } })}>
      Set printer
    </button>
  ),
}));

vi.mock("../src/hooks/useAutoUpdate", () => ({
  useAutoUpdate: () => ({ status: "idle" }),
}));

vi.mock("../src/hooks/useTheme", () => ({
  useTheme: () => ({ isDark: false, toggleTheme: vi.fn() }),
}));

import App from "../src/App";

function makeModelData(): ModelData {
  const group = new THREE.Group();
  group.add(new THREE.Mesh(new THREE.BoxGeometry(10, 10, 10)));
  return {
    group,
    info: {
      filename: "part.stl",
      format: "stl",
      fileSize: 1234,
      triCount: 12,
      bbox: { min: [-5, -5, -5], max: [5, 5, 5] },
      dimensions: { x: 10, y: 10, z: 10 },
    },
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

describe("App auto-split", () => {
  beforeEach(() => {
    mocks.loadModel.mockReset();
    mocks.runSegment.mockReset();
  });

  it("shows busy feedback while segmentation is running", async () => {
    const pending = deferred<[]>();
    mocks.loadModel.mockResolvedValue(makeModelData());
    mocks.runSegment.mockReturnValue(pending.promise);

    render(<App />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /load model/i }));
    await user.click(await screen.findByRole("button", { name: /set printer/i }));
    await user.click(await screen.findByRole("button", { name: /auto-split/i }));

    expect(mocks.runSegment).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Cutting…")).toBeInTheDocument();

    pending.resolve([]);
    await waitFor(() => expect(screen.queryByText("Cutting…")).not.toBeInTheDocument());
  });
});
