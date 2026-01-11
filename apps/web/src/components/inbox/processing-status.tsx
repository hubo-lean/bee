"use client";

import { Clock, Loader2, CheckCircle, AlertCircle, Archive } from "lucide-react";

export type InboxItemStatus = "pending" | "processing" | "reviewed" | "error" | "archived";

interface ProcessingStatusProps {
  status: InboxItemStatus;
  className?: string;
  showLabel?: boolean;
}

const statusConfig: Record<
  InboxItemStatus,
  {
    icon: typeof Clock;
    color: string;
    bgColor: string;
    animate?: boolean;
    label: string;
  }
> = {
  pending: {
    icon: Clock,
    color: "text-gray-500",
    bgColor: "bg-gray-100",
    label: "Pending",
  },
  processing: {
    icon: Loader2,
    color: "text-blue-500",
    bgColor: "bg-blue-100",
    animate: true,
    label: "Processing",
  },
  reviewed: {
    icon: CheckCircle,
    color: "text-green-500",
    bgColor: "bg-green-100",
    label: "Complete",
  },
  error: {
    icon: AlertCircle,
    color: "text-red-500",
    bgColor: "bg-red-100",
    label: "Error",
  },
  archived: {
    icon: Archive,
    color: "text-gray-400",
    bgColor: "bg-gray-50",
    label: "Archived",
  },
};

/**
 * Story 3.5: Processing status indicator for inbox items
 * Shows current classification status with appropriate icon and color
 */
export function ProcessingStatus({
  status,
  className,
  showLabel = true,
}: ProcessingStatusProps) {
  const config = statusConfig[status] ?? statusConfig.pending;
  const Icon = config.icon;

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full ${config.bgColor} ${className ?? ""}`}
    >
      <Icon
        className={`h-3.5 w-3.5 ${config.color} ${config.animate ? "animate-spin" : ""}`}
      />
      {showLabel && (
        <span className={`text-xs font-medium ${config.color}`}>
          {config.label}
        </span>
      )}
    </div>
  );
}

/**
 * Compact version showing just the icon
 */
export function ProcessingStatusIcon({
  status,
  className,
}: Omit<ProcessingStatusProps, "showLabel">) {
  const config = statusConfig[status] ?? statusConfig.pending;
  const Icon = config.icon;

  return (
    <Icon
      className={`h-4 w-4 ${config.color} ${config.animate ? "animate-spin" : ""} ${className ?? ""}`}
    />
  );
}
