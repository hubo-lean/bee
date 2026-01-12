"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

type ActionType = "agree" | "disagree" | "urgent" | "hide";

interface UndoToastProps {
  action: ActionType;
  onUndo: () => void;
  onExpire: () => void;
  duration?: number;
}

const ACTION_LABELS: Record<ActionType, string> = {
  agree: "Agreed",
  disagree: "Disagreed",
  urgent: "Marked urgent",
  hide: "Archived",
};

export function UndoToast({
  action,
  onUndo,
  onExpire,
  duration = 5,
}: UndoToastProps) {
  const [timeLeft, setTimeLeft] = useState(duration);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          onExpire();
          return 0;
        }
        return t - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [onExpire]);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 50, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.9 }}
        className={cn(
          "fixed bottom-20 left-1/2 -translate-x-1/2 z-50",
          "bg-gray-900 text-white px-4 py-3 rounded-full shadow-lg",
          "flex items-center gap-3"
        )}
      >
        <span className="text-sm">{ACTION_LABELS[action]}</span>
        <button
          onClick={onUndo}
          className="text-blue-400 font-medium hover:text-blue-300 transition-colors"
        >
          Undo ({timeLeft}s)
        </button>
      </motion.div>
    </AnimatePresence>
  );
}
