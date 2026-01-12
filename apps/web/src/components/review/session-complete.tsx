"use client";

import { motion } from "framer-motion";
import {
  PartyPopper,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Archive,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { type SessionStats } from "./progress-indicator";

interface SessionCompleteProps {
  stats: SessionStats;
  duration: number;
  onDone: () => void;
  onViewReceipts: () => void;
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes === 0) {
    return `${seconds}s`;
  }

  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

interface StatCardProps {
  icon: LucideIcon;
  value: number;
  label: string;
  color: "green" | "red" | "orange" | "gray";
}

function StatCard({ icon: Icon, value, label, color }: StatCardProps) {
  const colors = {
    green: "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400",
    red: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
    orange: "bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400",
    gray: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.3 }}
      className={`p-4 rounded-lg ${colors[color]}`}
    >
      <Icon className="h-6 w-6 mb-1" />
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-sm">{label}</div>
    </motion.div>
  );
}

export function SessionComplete({
  stats,
  duration,
  onDone,
  onViewReceipts,
}: SessionCompleteProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center justify-center h-full text-center px-8"
    >
      {/* Celebration animation */}
      <motion.div
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", delay: 0.2, stiffness: 200 }}
      >
        <PartyPopper className="h-24 w-24 text-yellow-500 mb-6" />
      </motion.div>

      <motion.h1
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="text-2xl font-bold mb-2"
      >
        Inbox Zero!
      </motion.h1>
      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="text-gray-600 dark:text-gray-400 mb-8"
      >
        {stats.total} items processed in {formatDuration(duration)}
      </motion.p>

      {/* Stats breakdown */}
      <div className="grid grid-cols-2 gap-4 w-full max-w-xs mb-8">
        <StatCard
          icon={CheckCircle}
          value={stats.agreed}
          label="Agreed"
          color="green"
        />
        <StatCard
          icon={XCircle}
          value={stats.disagreed}
          label="Disagreed"
          color="red"
        />
        <StatCard
          icon={AlertTriangle}
          value={stats.urgent}
          label="Urgent"
          color="orange"
        />
        <StatCard
          icon={Archive}
          value={stats.hidden}
          label="Archived"
          color="gray"
        />
      </div>

      {/* Actions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="space-y-3 w-full max-w-xs"
      >
        <Button onClick={onDone} className="w-full">
          Done
        </Button>
        <Button onClick={onViewReceipts} variant="outline" className="w-full">
          View Receipts
        </Button>
      </motion.div>
    </motion.div>
  );
}
