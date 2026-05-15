"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { extractImageFilesFromClipboardData } from "@/lib/capabilities/extractClipboardImages";

export type ClipboardPastedImageRow = { id: string; file: File; purpose: string };

type ClipboardQueueContextValue = {
  rows: ClipboardPastedImageRow[];
  appendImageFiles: (files: File[]) => void;
  clearQueue: () => void;
  setRowPurpose: (id: string, purpose: string) => void;
};

const ClipboardQueueContext = createContext<ClipboardQueueContextValue | null>(null);

function ClipboardGlobalPasteListener({ appendImageFiles }: { appendImageFiles: (files: File[]) => void }) {
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const files = extractImageFilesFromClipboardData(e.clipboardData);
      if (files.length === 0) return;
      e.preventDefault();
      appendImageFiles(files);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [appendImageFiles]);

  return null;
}

export function ClipboardImageQueueProvider({ children }: { children: ReactNode }) {
  const [rows, setRows] = useState<ClipboardPastedImageRow[]>([]);

  const appendImageFiles = useCallback((files: File[]) => {
    if (files.length === 0) return;
    setRows((prev) => [
      ...prev,
      ...files.map((file) => ({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
        file,
        purpose: "",
      })),
    ]);
  }, []);

  const clearQueue = useCallback(() => setRows([]), []);

  const setRowPurpose = useCallback((id: string, purpose: string) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, purpose } : r)));
  }, []);

  const value = useMemo(
    () => ({
      rows,
      appendImageFiles,
      clearQueue,
      setRowPurpose,
    }),
    [appendImageFiles, clearQueue, rows, setRowPurpose],
  );

  return (
    <ClipboardQueueContext.Provider value={value}>
      <ClipboardGlobalPasteListener appendImageFiles={appendImageFiles} />
      {children}
    </ClipboardQueueContext.Provider>
  );
}

export function useClipboardImageQueue(): ClipboardQueueContextValue {
  const ctx = useContext(ClipboardQueueContext);
  if (!ctx) throw new Error("useClipboardImageQueue must be used within ClipboardImageQueueProvider");
  return ctx;
}
