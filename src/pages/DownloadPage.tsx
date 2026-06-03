export function DownloadPage() {
  return (
    <div className="h-full w-full flex items-center justify-center layer-lines bg-[var(--bg)] text-[var(--ink)]">
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded shadow-lg p-6 max-w-md text-center">
        <h1 className="text-2xl font-bold mb-2">Pasak — Desktop</h1>
        <p className="text-[var(--ink-muted)] mb-4">
          Native Windows app for cutting larger 3D models without browser
          memory limits.
        </p>
        <a
          className="btn-primary inline-block px-4 py-2"
          href="https://github.com/Goodsmileduck/pasak3d/releases/latest"
          target="_blank"
          rel="noreferrer"
        >
          Download from GitHub Releases
        </a>
        <p className="text-xs text-[var(--ink-faint)] mt-4">
          Mac and Linux builds coming in v1.1.
        </p>
        <a
          className="block text-sm text-[var(--accent)] hover:underline mt-6"
          href="/"
        >← Back to Pasak</a>
      </div>
    </div>
  );
}
