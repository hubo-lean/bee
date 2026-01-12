"use client";

import { useState } from "react";
import { format } from "date-fns";
import {
  Target,
  Calendar,
  CalendarDays,
  MoreHorizontal,
  Check,
  Forward,
  Archive,
  ChevronDown,
  ChevronRight,
  FolderOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { trpc } from "@/lib/trpc";
import type { ObjectiveWithRelations } from "@/server/services/objectives.service";

interface ObjectiveCardProps {
  objective: ObjectiveWithRelations;
  onEdit?: (objective: ObjectiveWithRelations) => void;
  showChildren?: boolean;
}

const timeframeIcons = {
  yearly: Target,
  monthly: Calendar,
  weekly: CalendarDays,
};

const statusColors: Record<string, string> = {
  active: "bg-blue-100 text-blue-800",
  completed: "bg-green-100 text-green-800",
  deferred: "bg-yellow-100 text-yellow-800",
  archived: "bg-gray-100 text-gray-500",
};

export function ObjectiveCard({
  objective,
  onEdit,
  showChildren = true,
}: ObjectiveCardProps) {
  const [expanded, setExpanded] = useState(false);
  const utils = trpc.useUtils();

  const completeMutation = trpc.objectives.complete.useMutation({
    onSuccess: () => {
      utils.objectives.list.invalidate();
      utils.objectives.getCurrentWeek.invalidate();
    },
  });

  const carryForwardMutation = trpc.objectives.carryForward.useMutation({
    onSuccess: () => {
      utils.objectives.list.invalidate();
      utils.objectives.getCurrentWeek.invalidate();
    },
  });

  const archiveMutation = trpc.objectives.archive.useMutation({
    onSuccess: () => {
      utils.objectives.list.invalidate();
      utils.objectives.getCurrentWeek.invalidate();
    },
  });

  const TimeframeIcon = timeframeIcons[objective.timeframe as keyof typeof timeframeIcons] || Target;
  const hasChildren = objective.children && objective.children.length > 0;
  const isCompleted = objective.status === "completed";
  const isPending = completeMutation.isPending || carryForwardMutation.isPending || archiveMutation.isPending;

  return (
    <Card className={`mb-4 ${isCompleted ? "opacity-75" : ""}`}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <TimeframeIcon className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <CardTitle className="text-lg">{objective.title}</CardTitle>
              <CardDescription>
                Due: {format(new Date(objective.endDate), "MMM d, yyyy")}
              </CardDescription>
            </div>
          </div>
          <Badge className={statusColors[objective.status] || statusColors.active}>
            {objective.status}
          </Badge>
        </div>
      </CardHeader>

      <CardContent>
        {/* Progress bar */}
        <div className="mb-3 flex items-center gap-3">
          <Progress value={objective.progress} className="flex-1" />
          <span className="text-sm text-muted-foreground">{objective.progress}%</span>
        </div>

        {/* Description */}
        {objective.description && (
          <p className="mb-3 text-sm text-muted-foreground">{objective.description}</p>
        )}

        {/* Linked items */}
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          {hasChildren && (
            <span className="flex items-center gap-1">
              <Target className="h-4 w-4" />
              {objective.children.length} sub-objectives
            </span>
          )}
          {objective.projects && objective.projects.length > 0 && (
            <span className="flex items-center gap-1">
              <FolderOpen className="h-4 w-4" />
              {objective.projects.length} projects
            </span>
          )}
          {objective._count?.actions ? (
            <span className="flex items-center gap-1">
              <Check className="h-4 w-4" />
              {objective._count.actions} actions
            </span>
          ) : null}
        </div>

        {/* Expandable children */}
        {showChildren && expanded && hasChildren && (
          <div className="mt-4 border-l-2 border-muted pl-4">
            {objective.children.map((child) => (
              <ObjectiveCard
                key={child.id}
                objective={child as ObjectiveWithRelations}
                onEdit={onEdit}
                showChildren={false}
              />
            ))}
          </div>
        )}
      </CardContent>

      <CardFooter className="pt-0">
        <div className="flex w-full items-center justify-between">
          <div className="flex gap-2">
            {showChildren && hasChildren && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setExpanded(!expanded)}
              >
                {expanded ? (
                  <>
                    <ChevronDown className="mr-1 h-4 w-4" />
                    Collapse
                  </>
                ) : (
                  <>
                    <ChevronRight className="mr-1 h-4 w-4" />
                    Expand
                  </>
                )}
              </Button>
            )}
            {onEdit && (
              <Button variant="ghost" size="sm" onClick={() => onEdit(objective)}>
                Edit
              </Button>
            )}
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" disabled={isPending}>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {!isCompleted && (
                <DropdownMenuItem
                  onClick={() => completeMutation.mutate({ id: objective.id })}
                  disabled={isPending}
                >
                  <Check className="mr-2 h-4 w-4" />
                  Mark Complete
                </DropdownMenuItem>
              )}
              {!isCompleted && objective.status !== "deferred" && (
                <DropdownMenuItem
                  onClick={() => carryForwardMutation.mutate({ id: objective.id })}
                  disabled={isPending}
                >
                  <Forward className="mr-2 h-4 w-4" />
                  Carry Forward
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => archiveMutation.mutate({ id: objective.id })}
                disabled={isPending}
                className="text-destructive focus:text-destructive"
              >
                <Archive className="mr-2 h-4 w-4" />
                Archive
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardFooter>
    </Card>
  );
}
