type Props = {
  onClose: () => void;
};

const SHORTCUTS: Array<{ key: string; action: string }> = [
  { key: "O", action: "Open file" },
  { key: "X / Y / Z", action: "Start cut on selected axis" },
  { key: "Enter", action: "Confirm cut" },
  { key: "Esc", action: "Cancel cut / close modal" },
  { key: "Ctrl+Z", action: "Undo" },
  { key: "Ctrl+Shift+Z", action: "Redo" },
  { key: "Ctrl+E", action: "Export" },
  { key: "?", action: "Toggle this help" },
];

export function HelpOverlay({ onClose }: Props) {
  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded shadow-lg p-6 max-w-md w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold">Keyboard Shortcuts</h3>
          <button
            className="text-slate-500 hover:text-slate-900 text-sm"
            onClick={onClose}
          >Close</button>
        </div>
        <table className="w-full text-sm">
          <tbody>
            {SHORTCUTS.map((s) => (
              <tr key={s.key} className="border-b border-slate-100 last:border-0">
                <td className="py-1.5 font-mono text-xs text-slate-700 w-32">{s.key}</td>
                <td className="py-1.5 text-slate-600">{s.action}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
