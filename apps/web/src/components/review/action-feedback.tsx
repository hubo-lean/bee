"use client";

import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { SWIPE_FEEDBACK, type SwipeDirection } from "@/lib/constants/swipe";
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  Archive,
} from "lucide-react";

interface ActionFeedbackProps {
  action: SwipeDirection | null;
  category?: string;
  isVisible: boolean;
}

const ACTION_ICONS = {
  right: CheckCircle,
  left: XCircle,
  up: AlertTriangle,
  down: Archive,
} as const;

const ACTION_MESSAGES: Record<SwipeDirection, (category?: string) => string> = {
  right: (category) => `Filed as ${category || "reviewed"}`,
  left: () => "Opening correction...",
  up: () => "Marked urgent",
  down: () => "Archived",
};

export function ActionFeedback({
  action,
  category,
  isVisible,
}: ActionFeedbackProps) {
  if (!action) return null;

  const feedback = SWIPE_FEEDBACK[action];
  const Icon = ACTION_ICONS[action];
  const message = ACTION_MESSAGES[action](category);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{ duration: 0.2 }}
          className={cn(
            "fixed inset-0 z-40 flex items-center justify-center",
            "pointer-events-none"
          )}
        >
          <div
            className={cn(
              "flex flex-col items-center gap-3 p-8 rounded-2xl",
              "bg-white/90 backdrop-blur-sm shadow-xl"
            )}
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", damping: 15, stiffness: 300 }}
            >
              <Icon className={cn("h-16 w-16", feedback.color)} />
            </motion.div>
            <span className={cn("text-lg font-semibold", feedback.color)}>
              {message}
            </span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
