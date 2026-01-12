"use client";

import { motion } from "framer-motion";
import { Check, X, AlertTriangle, Archive } from "lucide-react";

export interface SessionStats {
  agreed: number;
  disagreed: number;
  urgent: number;
  hidden: number;
  total: number;
  totalTimeMs?: number;
}

interface ProgressIndicatorProps {
  current: number;
  total: number;
  stats: SessionStats;
}

export function ProgressIndicator({
  current,
  total,
  stats,
}: ProgressIndicatorProps) {
  const progress = total > 0 ? (current / total) * 100 : 0;

  return (
    <div className="space-y-2">
      {/* Progress bar */}
      <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-blue-500"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        />
      </div>

      {/* Counter */}
      <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
        <span>
          {current} of {total}
        </span>
        <span>{total - current} remaining</span>
      </div>

      {/* Mini stats */}
      <div className="flex gap-4 text-xs">
        <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
          <Check className="h-3 w-3" />
          {stats.agreed}
        </span>
        <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
          <X className="h-3 w-3" />
          {stats.disagreed}
        </span>
        <span className="flex items-center gap-1 text-orange-600 dark:text-orange-400">
          <AlertTriangle className="h-3 w-3" />
          {stats.urgent}
        </span>
        <span className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
          <Archive className="h-3 w-3" />
          {stats.hidden}
        </span>
      </div>
    </div>
  );
}
