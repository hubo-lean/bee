"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Calendar, FolderKanban, CircleDot } from "lucide-react";
import { format } from "date-fns";

interface ActionCardProps {
  action: {
    id: string;
    description: string;
    status: string;
    priority: string;
    dueDate: Date | null;
    scheduledFor: Date | null;
    project?: {
      id: string;
      name: string;
      color: string | null;
    } | null;
    area?: {
      id: string;
      name: string;
      icon: string | null;
      color: string | null;
    } | null;
  };
  onToggleComplete: () => void;
  isOverdue?: boolean;
}

const priorityColors: Record<string, string> = {
  urgent: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  high: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  normal: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
  low: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
};

export function ActionCard({
  action,
  onToggleComplete,
  isOverdue = false,
}: ActionCardProps) {
  const isCompleted = action.status === "completed";

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-lg border p-4 transition-colors",
        isOverdue && !isCompleted && "border-destructive/50 bg-destructive/5",
        isCompleted && "opacity-60"
      )}
    >
      {/* Checkbox */}
      <Checkbox
        checked={isCompleted}
        onCheckedChange={onToggleComplete}
        className="mt-1"
        aria-label={isCompleted ? "Mark as incomplete" : "Mark as complete"}
      />

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p
          className={cn(
            "font-medium",
            isCompleted && "line-through text-muted-foreground"
          )}
        >
          {action.description}
        </p>

        {/* Metadata Row */}
        <div className="flex flex-wrap items-center gap-2 mt-2">
          {/* Priority Badge */}
          {action.priority !== "normal" && (
            <Badge
              variant="secondary"
              className={cn("text-xs", priorityColors[action.priority])}
            >
              {action.priority}
            </Badge>
          )}

          {/* Due Date */}
          {action.dueDate && (
            <span
              className={cn(
                "flex items-center gap-1 text-xs text-muted-foreground",
                isOverdue && "text-destructive font-medium"
              )}
            >
              <Calendar className="h-3 w-3" />
              {format(new Date(action.dueDate), "MMM d")}
            </span>
          )}

          {/* Project */}
          {action.project && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <FolderKanban className="h-3 w-3" />
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: action.project.color || "#6b7280" }}
              />
              {action.project.name}
            </span>
          )}

          {/* Area */}
          {action.area && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              {action.area.icon ? (
                <span>{action.area.icon}</span>
              ) : (
                <CircleDot className="h-3 w-3" />
              )}
              {action.area.name}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
