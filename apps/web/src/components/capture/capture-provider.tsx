"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import { CaptureModal } from "./capture-modal";

interface CaptureContextType {
  openCapture: () => void;
  closeCapture: () => void;
  isOpen: boolean;
}

const CaptureContext = createContext<CaptureContextType | null>(null);

interface CaptureProviderProps {
  children: ReactNode;
}

export function CaptureProvider({ children }: CaptureProviderProps) {
  const [isOpen, setIsOpen] = useState(false);

  const openCapture = useCallback(() => setIsOpen(true), []);
  const closeCapture = useCallback(() => setIsOpen(false), []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + K to open capture
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen(true);
      }

      // Escape to close
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  return (
    <CaptureContext.Provider value={{ openCapture, closeCapture, isOpen }}>
      {children}
      <CaptureModal isOpen={isOpen} onClose={closeCapture} />
    </CaptureContext.Provider>
  );
}

export function useCapture() {
  const context = useContext(CaptureContext);
  if (!context) {
    throw new Error("useCapture must be used within a CaptureProvider");
  }
  return context;
}
