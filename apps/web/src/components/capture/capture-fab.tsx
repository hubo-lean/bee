"use client";

import { motion } from "framer-motion";
import { Plus } from "lucide-react";
import { useCapture } from "./capture-provider";
import { cn } from "@/lib/utils";

interface CaptureFabProps {
  className?: string;
}

export function CaptureFab({ className }: CaptureFabProps) {
  const { openCapture } = useCapture();

  return (
    <motion.button
      onClick={openCapture}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className={cn(
        "fixed bottom-20 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 md:hidden",
        "pb-safe",
        className
      )}
      aria-label="Capture new item"
    >
      <Plus className="h-6 w-6" aria-hidden="true" />
    </motion.button>
  );
}
