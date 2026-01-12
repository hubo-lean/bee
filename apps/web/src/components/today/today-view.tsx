"use client";

import { trpc } from "@/lib/trpc";
import { ActionCard } from "./action-card";
import { Skeleton } from "@/components/ui/skeleton";
import { CalendarX, CheckCircle2, Calendar, Clock } from "lucide-react";

export function TodayView() {
  const { data: actions, isLoading } = trpc.actions.getToday.useQuery();
  const utils = trpc.useUtils();

  const toggleComplete = trpc.actions.toggleComplete.useMutation({
    onSuccess: () => {
      utils.actions.getToday.invalidate();
      utils.actions.getTodayCount.invalidate();
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (!actions || actions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="rounded-full bg-green-100 dark:bg-green-900 p-4 mb-4">
          <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
        </div>
        <h3 className="text-lg font-medium mb-2">All clear for today!</h3>
        <p className="text-sm text-muted-foreground max-w-sm">
          No actions scheduled or due. Enjoy your day or add new actions.
        </p>
      </div>
    );
  }

  // Group actions by type
  const overdueActions = actions.filter((a) => a.isOverdue);
  const dueTodayActions = actions.filter((a) => !a.isOverdue && a.isDueToday);
  const scheduledTodayActions = actions.filter(
    (a) => !a.isOverdue && !a.isDueToday && a.isScheduledToday
  );

  return (
    <div className="space-y-8">
      {/* Overdue Section */}
      {overdueActions.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <CalendarX className="h-5 w-5 text-destructive" />
            <h2 className="text-lg font-semibold text-destructive">
              Overdue ({overdueActions.length})
            </h2>
          </div>
          <div className="space-y-3">
            {overdueActions.map((action) => (
              <ActionCard
                key={action.id}
                action={action}
                onToggleComplete={() => toggleComplete.mutate({ id: action.id })}
                isOverdue
              />
            ))}
          </div>
        </section>
      )}

      {/* Due Today Section */}
      {dueTodayActions.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">
              Due Today ({dueTodayActions.length})
            </h2>
          </div>
          <div className="space-y-3">
            {dueTodayActions.map((action) => (
              <ActionCard
                key={action.id}
                action={action}
                onToggleComplete={() => toggleComplete.mutate({ id: action.id })}
              />
            ))}
          </div>
        </section>
      )}

      {/* Scheduled Today Section */}
      {scheduledTodayActions.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Clock className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold text-muted-foreground">
              Scheduled ({scheduledTodayActions.length})
            </h2>
          </div>
          <div className="space-y-3">
            {scheduledTodayActions.map((action) => (
              <ActionCard
                key={action.id}
                action={action}
                onToggleComplete={() => toggleComplete.mutate({ id: action.id })}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
