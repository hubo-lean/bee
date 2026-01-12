"use client";

import { cn } from "@/lib/utils";
import { SWIPE_FEEDBACK, type SwipeDirection } from "@/lib/constants/swipe";
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  Archive,
} from "lucide-react";

interface SwipeFeedbackProps {
  direction: SwipeDirection | null;
  opacity: number;
  className?: string;
}

const DIRECTION_ICONS = {
  right: CheckCircle,
  left: XCircle,
  up: AlertTriangle,
  down: Archive,
} as const;

export function SwipeFeedback({
  direction,
  opacity,
  className,
}: SwipeFeedbackProps) {
  if (!direction || opacity <= 0) return null;

  const feedback = SWIPE_FEEDBACK[direction];
  const Icon = DIRECTION_ICONS[direction];

  return (
    <div
      className={cn(
        "absolute inset-0 flex items-center justify-center pointer-events-none rounded-xl transition-colors",
        feedback.bg,
        className
      )}
      style={{ opacity }}
    >
      <div className="flex flex-col items-center gap-2">
        <Icon className={cn("h-16 w-16", feedback.color)} />
        <span className={cn("text-lg font-semibold", feedback.color)}>
          {feedback.label}
        </span>
      </div>
    </div>
  );
}
