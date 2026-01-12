"use client";

import { useState } from "react";
import { Check, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type {
  WeeklyReviewSessionWithData,
  ActionsStepData,
} from "@/server/services/weekly-review.service";

interface ActionsStepProps {
  session: WeeklyReviewSessionWithData;
  onComplete: (data: ActionsStepData) => void;
  onBack: () => void;
}

// Placeholder action type until actions router is fully implemented
interface ActionItem {
  id: string;
  description: string;
  priority: "urgent" | "high" | "normal" | "low";
  dueDate?: string;
  projectName?: string;
}

export function ActionsStep({ session, onComplete, onBack }: ActionsStepProps) {
  const priorities = session.data.priorities;

  // Placeholder actions - in real implementation, would query based on selected priorities
  const [actions] = useState<ActionItem[]>([
    {
      id: "1",
      description: "Review quarterly goals",
      priority: "high",
      projectName: "MVP Launch",
    },
    {
      id: "2",
      description: "Schedule team sync",
      priority: "normal",
      projectName: "MVP Launch",
    },
    {
      id: "3",
      description: "Update documentation",
      priority: "low",
      projectName: "Documentation",
    },
    {
      id: "4",
      description: "Morning workout routine",
      priority: "normal",
    },
    {
      id: "5",
      description: "Review budget spreadsheet",
      priority: "high",
    },
  ]);

  const [reviewed, setReviewed] = useState<string[]>(
    session.data.actions?.reviewed || []
  );
  const [completed, setCompleted] = useState<string[]>(
    session.data.actions?.completed || []
  );
  const [scheduled, setScheduled] = useState<string[]>(
    session.data.actions?.scheduled || []
  );

  const [isLoading] = useState(false);

  const handleToggleReviewed = (id: string) => {
    if (reviewed.includes(id)) {
      setReviewed(reviewed.filter((r) => r !== id));
    } else {
      setReviewed([...reviewed, id]);
    }
  };

  const handleToggleComplete = (id: string) => {
    if (completed.includes(id)) {
      setCompleted(completed.filter((c) => c !== id));
    } else {
      setCompleted([...completed, id]);
      // Also mark as reviewed
      if (!reviewed.includes(id)) {
        setReviewed([...reviewed, id]);
      }
    }
  };

  const handleSchedule = (id: string) => {
    if (!scheduled.includes(id)) {
      setScheduled([...scheduled, id]);
      // Also mark as reviewed
      if (!reviewed.includes(id)) {
        setReviewed([...reviewed, id]);
      }
    }
  };

  const handleNext = () => {
    onComplete({ reviewed, scheduled, completed });
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent":
        return "bg-red-100 text-red-800";
      case "high":
        return "bg-orange-100 text-orange-800";
      case "normal":
        return "bg-blue-100 text-blue-800";
      case "low":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-7 w-48 mb-2" />
          <Skeleton className="h-5 w-80" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  // Group actions by project
  const projectActions = actions.filter((a) => a.projectName);
  const unassignedActions = actions.filter((a) => !a.projectName);

  // Get unique projects
  const projects = Array.from(new Set(projectActions.map((a) => a.projectName))).filter(
    (p): p is string => p !== undefined
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold mb-2">Review Actions</h2>
        <p className="text-muted-foreground">
          Review your action items for the selected priorities.
          Mark items as complete or schedule time blocks.
        </p>
      </div>

      {/* Selection Info */}
      {priorities && (
        <div className="text-sm text-muted-foreground">
          Showing actions for {priorities.selectedProjects.length} project(s) and{" "}
          {priorities.selectedAreas.length} area(s)
        </div>
      )}

      {/* Actions by Project */}
      {projects.map((projectName) => (
        <Card key={projectName}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{projectName}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {projectActions
              .filter((a) => a.projectName === projectName)
              .map((action) => (
                <ActionRow
                  key={action.id}
                  action={action}
                  isReviewed={reviewed.includes(action.id)}
                  isCompleted={completed.includes(action.id)}
                  isScheduled={scheduled.includes(action.id)}
                  onToggleReview={() => handleToggleReviewed(action.id)}
                  onToggleComplete={() => handleToggleComplete(action.id)}
                  onSchedule={() => handleSchedule(action.id)}
                  getPriorityColor={getPriorityColor}
                />
              ))}
          </CardContent>
        </Card>
      ))}

      {/* Unassigned Actions */}
      {unassignedActions.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Other Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {unassignedActions.map((action) => (
              <ActionRow
                key={action.id}
                action={action}
                isReviewed={reviewed.includes(action.id)}
                isCompleted={completed.includes(action.id)}
                isScheduled={scheduled.includes(action.id)}
                onToggleReview={() => handleToggleReviewed(action.id)}
                onToggleComplete={() => handleToggleComplete(action.id)}
                onSchedule={() => handleSchedule(action.id)}
                getPriorityColor={getPriorityColor}
              />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Summary */}
      <div className="text-sm text-muted-foreground">
        Reviewed: {reviewed.length} | Completed: {completed.length} | Scheduled:{" "}
        {scheduled.length}
      </div>

      {/* Navigation */}
      <div className="flex justify-between pt-4 border-t">
        <Button variant="outline" onClick={onBack}>
          ← Back
        </Button>
        <Button onClick={handleNext}>
          Next: Inbox →
        </Button>
      </div>
    </div>
  );
}

interface ActionRowProps {
  action: ActionItem;
  isReviewed: boolean;
  isCompleted: boolean;
  isScheduled: boolean;
  onToggleReview: () => void;
  onToggleComplete: () => void;
  onSchedule: () => void;
  getPriorityColor: (priority: string) => string;
}

function ActionRow({
  action,
  isReviewed,
  isCompleted,
  isScheduled,
  onToggleReview,
  onToggleComplete,
  onSchedule,
  getPriorityColor,
}: ActionRowProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 p-3 rounded-lg border transition-colors",
        isReviewed && "bg-muted/30",
        isCompleted && "opacity-60"
      )}
    >
      <Checkbox
        checked={isReviewed}
        onCheckedChange={onToggleReview}
        className="flex-shrink-0"
      />
      <div className="flex-1 min-w-0">
        <p className={cn("font-medium", isCompleted && "line-through")}>
          {action.description}
        </p>
        <div className="flex items-center gap-2 mt-1">
          <Badge className={getPriorityColor(action.priority)} variant="secondary">
            {action.priority}
          </Badge>
          {action.dueDate && (
            <span className="text-xs text-muted-foreground">{action.dueDate}</span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleComplete}
          className={cn(isCompleted && "text-green-600")}
        >
          <Check className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onSchedule}
          className={cn(isScheduled && "text-blue-600")}
        >
          <Calendar className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
