"use client";

import { useState } from "react";
import { Plus, MoreHorizontal, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { CreateObjectiveModal } from "@/components/objectives/create-objective-modal";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import type {
  WeeklyReviewSessionWithData,
  ObjectivesStepData,
} from "@/server/services/weekly-review.service";

interface ObjectivesStepProps {
  session: WeeklyReviewSessionWithData;
  onComplete: (data: ObjectivesStepData) => void;
}

export function ObjectivesStep({ session, onComplete }: ObjectivesStepProps) {
  const { data: weekObjectives, isLoading } = trpc.objectives.getCurrentWeek.useQuery();
  const utils = trpc.useUtils();

  const [confirmed, setConfirmed] = useState<string[]>(
    session.data.objectives?.confirmed || []
  );
  const [deferred, setDeferred] = useState<string[]>(
    session.data.objectives?.deferred || []
  );
  const [added] = useState<string[]>(
    session.data.objectives?.added || []
  );
  const [showCreateModal, setShowCreateModal] = useState(false);

  const carryForwardMutation = trpc.objectives.carryForward.useMutation({
    onSuccess: (newObjective) => {
      setDeferred((prev) => [...prev, newObjective.id]);
      utils.objectives.getCurrentWeek.invalidate();
    },
  });

  const handleToggleConfirm = (id: string) => {
    if (confirmed.includes(id)) {
      setConfirmed(confirmed.filter((i) => i !== id));
    } else {
      setConfirmed([...confirmed, id]);
      // Remove from deferred if it was there
      setDeferred(deferred.filter((i) => i !== id));
    }
  };

  const handleDefer = async (id: string) => {
    await carryForwardMutation.mutateAsync({ id });
  };

  const handleNext = () => {
    onComplete({ confirmed, added, deferred });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-7 w-64 mb-2" />
          <Skeleton className="h-5 w-96" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold mb-2">
          Review This Week&apos;s Objectives
        </h2>
        <p className="text-muted-foreground">
          Confirm your focus areas for the week. Check objectives you want to keep,
          or defer ones that no longer apply.
        </p>
      </div>

      {/* Objectives List */}
      {weekObjectives && weekObjectives.length > 0 ? (
        <div className="space-y-3">
          {weekObjectives.map((objective) => {
            const isConfirmed = confirmed.includes(objective.id);
            const isDeferred = deferred.includes(objective.id);

            return (
              <Card
                key={objective.id}
                className={cn(
                  "cursor-pointer transition-all",
                  isConfirmed && "border-green-500 bg-green-50",
                  isDeferred && "opacity-50"
                )}
              >
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Checkbox
                        checked={isConfirmed}
                        disabled={isDeferred}
                        onCheckedChange={() => handleToggleConfirm(objective.id)}
                      />
                      <div className="flex items-center gap-2">
                        <Target className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className={cn("font-medium", isDeferred && "line-through")}>
                            {objective.title}
                          </p>
                          {objective.parent && (
                            <p className="text-sm text-muted-foreground">
                              Part of: {objective.parent.title}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={carryForwardMutation.isPending}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => handleDefer(objective.id)}
                          disabled={isDeferred}
                        >
                          Defer to Next Week
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center">
            <Target className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
            <p className="text-muted-foreground">
              No weekly objectives yet. Add some to focus your week!
            </p>
          </CardContent>
        </Card>
      )}

      {/* Add New Objective */}
      <Button
        variant="outline"
        className="w-full"
        onClick={() => setShowCreateModal(true)}
      >
        <Plus className="h-4 w-4 mr-2" />
        Add Weekly Objective
      </Button>

      {/* Navigation */}
      <div className="flex justify-end pt-4 border-t">
        <Button onClick={handleNext}>
          Next: Priorities →
        </Button>
      </div>

      {/* Create Modal */}
      <CreateObjectiveModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        defaultTimeframe="weekly"
      />
    </div>
  );
}
