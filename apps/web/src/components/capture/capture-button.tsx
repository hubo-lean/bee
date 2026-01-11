"use client";

import { cn } from "@/lib/utils";
import { Plus } from "lucide-react";

interface CaptureButtonProps {
  className?: string;
}

export function CaptureButton({ className }: CaptureButtonProps) {
  const handleCapture = () => {
    // Placeholder for Epic 2 implementation
    console.log("Capture button clicked");
  };

  return (
    <button
      onClick={handleCapture}
      className={cn(
        "fixed bottom-20 right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 active:scale-95",
        className
      )}
      aria-label="Capture new item"
    >
      <Plus className="h-6 w-6" aria-hidden="true" />
    </button>
  );
}
