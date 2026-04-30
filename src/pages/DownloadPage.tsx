export function DownloadPage() {
  return (
    <div className="h-full w-full flex items-center justify-center bg-slate-100">
      <div className="bg-white rounded shadow p-6 max-w-md text-center">
        <h1 className="text-2xl font-bold mb-2">Pasak — Desktop</h1>
        <p className="text-slate-600 mb-4">
          Native Windows app for cutting larger 3D models without browser
          memory limits.
        </p>
        <a
          className="inline-block bg-emerald-600 text-white px-4 py-2 rounded font-medium hover:bg-emerald-700 transition-colors"
          href="https://github.com/Goodsmileduck/pasak/releases/latest"
          target="_blank"
          rel="noreferrer"
        >
          Download from GitHub Releases
        </a>
        <p className="text-xs text-slate-500 mt-4">
          Mac and Linux builds coming in v1.1.
        </p>
        <a
          className="block text-sm text-blue-600 hover:underline mt-6"
          href="/"
        >← Back to Pasak</a>
      </div>
    </div>
  );
}
