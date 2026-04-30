/**
 * File save utility — uses native Tauri save dialog on desktop, blob download in browser.
 */

const isDesktop = import.meta.env.VITE_TARGET !== "web";

export async function saveBytes(
  filename: string,
  mimeType: string,
  bytes: ArrayBuffer | Uint8Array,
): Promise<void> {
  const buffer = bytes instanceof Uint8Array ? (bytes.buffer as ArrayBuffer) : bytes;

  if (isDesktop) {
    try {
      const { save } = await import("@tauri-apps/plugin-dialog");
      const { writeFile } = await import("@tauri-apps/plugin-fs");
      const path = await save({ defaultPath: filename });
      if (!path) return;
      const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(buffer);
      await writeFile(path, u8);
      return;
    } catch (e) {
      // Fall through to browser blob download as a safety net
      console.error("Tauri save failed, falling back to browser download:", e);
    }
  }

  const blob = new Blob([buffer], { type: mimeType });
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
