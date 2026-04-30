/**
 * Browser-only file save utility.
 * Tauri support will be added in M4.
 */
export function saveBytes(filename: string, mimeType: string, bytes: ArrayBuffer | Uint8Array): void {
  const data = bytes instanceof Uint8Array ? (bytes.buffer as ArrayBuffer) : bytes;
  const blob = new Blob([data], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function deriveExportFilename(originalFilename: string, newExtension: string): string {
  const baseName = originalFilename.replace(/\.[^.]+$/, "");
  return `${baseName}.${newExtension}`;
}
