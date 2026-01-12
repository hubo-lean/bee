"use client";

import { format } from "date-fns";
import { CheckCircle, Circle } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import {
  getStepsWithStatus,
  calculateProgress,
  type WeeklyReviewSessionWithData,
} from "@/server/services/weekly-review.service";

interface ProgressSidebarProps {
  session: WeeklyReviewSessionWithData;
}

export function ProgressSidebar({ session }: ProgressSidebarProps) {
  const steps = getStepsWithStatus(session);
  const progress = calculateProgress(session);

  return (
    <div className="w-64 border-r bg-muted/30 p-4 flex flex-col">
      <div className="mb-6">
        <h2 className="font-semibold text-lg">Weekly Review</h2>
        <p className="text-sm text-muted-foreground">
          {format(new Date(session.weekStart), "MMM d, yyyy")}
        </p>
      </div>

      {/* Steps Navigation */}
      <nav className="space-y-1 flex-1">
        {steps.map((step, index) => (
          <div
            key={step.key}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors",
              step.isCurrent && "bg-primary/10 text-primary font-medium",
              step.isComplete && !step.isCurrent && "text-green-600"
            )}
          >
            <div className="flex-shrink-0">
              {step.isComplete ? (
                <CheckCircle className="h-5 w-5" />
              ) : step.isCurrent ? (
                <div className="relative">
                  <Circle className="h-5 w-5" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-xs font-medium">{index + 1}</span>
                  </div>
                </div>
              ) : (
                <Circle className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
            <span className={cn(!step.isCurrent && !step.isComplete && "text-muted-foreground")}>
              {step.label}
            </span>
          </div>
        ))}
      </nav>

      {/* Progress */}
      <div className="pt-4 border-t">
        <p className="text-sm text-muted-foreground mb-2">Progress</p>
        <Progress value={progress.percentage} className="h-2" />
        <p className="text-sm text-muted-foreground mt-2">
          {progress.completedSteps} of {progress.totalSteps} steps
        </p>
      </div>
    </div>
  );
}
