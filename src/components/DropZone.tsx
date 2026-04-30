import { useState, useCallback, useEffect, useRef } from "react";
import { SUPPORTED_EXTENSIONS } from "../lib/loaders";

interface DropZoneProps {
  onFile: (file: File) => void;
  isDark: boolean;
  children: React.ReactNode;
}

export function DropZone({ onFile, isDark, children }: DropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const dragCountRef = useRef(0);

  const handleDragEnter = useCallback((e: DragEvent) => {
    e.preventDefault();
    dragCountRef.current += 1;
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    dragCountRef.current -= 1;
    if (dragCountRef.current <= 0) {
      dragCountRef.current = 0;
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.dataTransfer!.dropEffect = "copy";
    setIsDragging(true);
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      dragCountRef.current = 0;

      const files = Array.from(e.dataTransfer?.files ?? []);
      if (files.length === 0) return;

      // Pick first supported file
      const supported = files.find((f) => {
        const ext = "." + f.name.split(".").pop()?.toLowerCase();
        return SUPPORTED_EXTENSIONS.includes(ext);
      });

      if (supported) {
        onFile(supported);
      } else {
        console.warn("No supported 3D file in drop", files.map((f) => f.name));
      }
    },
    [onFile]
  );

  useEffect(() => {
    window.addEventListener("dragenter", handleDragEnter);
    window.addEventListener("dragleave", handleDragLeave);
    window.addEventListener("dragover", handleDragOver);
    window.addEventListener("drop", handleDrop);
    return () => {
      window.removeEventListener("dragenter", handleDragEnter);
      window.removeEventListener("dragleave", handleDragLeave);
      window.removeEventListener("dragover", handleDragOver);
      window.removeEventListener("drop", handleDrop);
    };
  }, [handleDragEnter, handleDragLeave, handleDragOver, handleDrop]);

  return (
    <div className="relative w-full h-full min-w-0">
      {children}

      {/* Drop overlay */}
      {isDragging && (
        <div
          className={`absolute inset-0 z-50 flex flex-col items-center justify-center pointer-events-none rounded-sm border-4 border-dashed ${
            isDark
              ? "bg-blue-900/60 border-blue-400"
              : "bg-blue-50/80 border-blue-500"
          }`}
        >
          <div className="text-4xl mb-3">📂</div>
          <p
            className={`text-lg font-semibold ${
              isDark ? "text-blue-300" : "text-blue-700"
            }`}
          >
            Drop STL, OBJ, 3MF, or GLB to begin
          </p>
          <p
            className={`text-sm mt-1 ${
              isDark ? "text-blue-400" : "text-blue-500"
            }`}
          >
            {SUPPORTED_EXTENSIONS.join(", ")}
          </p>
        </div>
      )}
    </div>
  );
}
