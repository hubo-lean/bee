"use client";

import { cn } from "@/lib/utils";
import { CONFIDENCE_THRESHOLDS } from "@/lib/constants/swipe";

interface ConfidenceBadgeProps {
  confidence: number;
  className?: string;
}

const CONFIDENCE_STYLES = {
  high: { color: "text-green-600", bg: "bg-green-100" },
  medium: { color: "text-yellow-600", bg: "bg-yellow-100" },
  low: { color: "text-red-600", bg: "bg-red-100" },
} as const;

function getConfidenceLevel(confidence: number): keyof typeof CONFIDENCE_STYLES {
  if (confidence >= CONFIDENCE_THRESHOLDS.high) return "high";
  if (confidence >= CONFIDENCE_THRESHOLDS.medium) return "medium";
  return "low";
}

export function ConfidenceBadge({ confidence, className }: ConfidenceBadgeProps) {
  const level = getConfidenceLevel(confidence);
  const styles = CONFIDENCE_STYLES[level];
  const percentage = Math.round(confidence * 100);

  return (
    <div
      className={cn(
        "inline-flex items-center px-2 py-1 rounded-full text-sm font-medium",
        styles.bg,
        styles.color,
        className
      )}
    >
      {percentage}%
    </div>
  );
}
