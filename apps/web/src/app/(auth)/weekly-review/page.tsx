"use client";

import dynamic from "next/dynamic";
import { format } from "date-fns";
import { Calendar, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ProgressSidebar } from "@/components/weekly-review/progress-sidebar";
import { trpc } from "@/lib/trpc";
import {
  getCurrentWeekStart,
  calculateProgress,
  type ObjectivesStepData,
  type PrioritiesStepData,
  type ActionsStepData,
  type InboxStepData,
} from "@/server/services/weekly-review.service";

// Lazy load step components for code splitting
function StepSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-7 w-48 mb-2" />
        <Skeleton className="h-5 w-80" />
      </div>
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}

const ObjectivesStep = dynamic(
  () =>
    import("@/components/weekly-review/objectives-step").then(
      (m) => m.ObjectivesStep
    ),
  { loading: () => <StepSkeleton /> }
);

const PrioritiesStep = dynamic(
  () =>
    import("@/components/weekly-review/priorities-step").then(
      (m) => m.PrioritiesStep
    ),
  { loading: () => <StepSkeleton /> }
);

const ActionsStep = dynamic(
  () =>
    import("@/components/weekly-review/actions-step").then(
      (m) => m.ActionsStep
    ),
  { loading: () => <StepSkeleton /> }
);

const InboxStep = dynamic(
  () =>
    import("@/components/weekly-review/inbox-step").then((m) => m.InboxStep),
  { loading: () => <StepSkeleton /> }
);

export default function WeeklyReviewPage() {
  const utils = trpc.useUtils();
  const { data: session, isLoading } = trpc.weeklyReview.getSession.useQuery();
  const startSession = trpc.weeklyReview.startSession.useMutation({
    onSuccess: () => {
      utils.weeklyReview.getSession.invalidate();
    },
    onError: (error) => {
      console.error("Failed to start weekly review session:", error);
    },
  });
  const completeStep = trpc.weeklyReview.completeStep.useMutation({
    onSuccess: () => {
      utils.weeklyReview.getSession.invalidate();
    },
  });

  const handleCompleteObjectives = (data: ObjectivesStepData) => {
    if (!session) return;
    completeStep.mutate({
      sessionId: session.id,
      step: "objectives",
      data,
    });
  };

  const handleCompletePriorities = (data: PrioritiesStepData) => {
    if (!session) return;
    completeStep.mutate({
      sessionId: session.id,
      step: "priorities",
      data,
    });
  };

  const handleCompleteActions = (data: ActionsStepData) => {
    if (!session) return;
    completeStep.mutate({
      sessionId: session.id,
      step: "actions",
      data,
    });
  };

  const handleCompleteInbox = (data: InboxStepData) => {
    if (!session) return;
    completeStep.mutate({
      sessionId: session.id,
      step: "inbox",
      data,
    });
  };

  const handleGoBack = (fromStep: "priorities" | "actions" | "inbox") => {
    if (!session) return;
    const prevStepMap = {
      priorities: "objectives" as const,
      actions: "priorities" as const,
      inbox: "actions" as const,
    };
    completeStep.mutate({
      sessionId: session.id,
      step: prevStepMap[fromStep],
      goBack: true,
    });
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex h-[calc(100vh-8rem)]">
        <div className="w-64 border-r p-4">
          <Skeleton className="h-6 w-32 mb-2" />
          <Skeleton className="h-4 w-24 mb-6" />
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        </div>
        <div className="flex-1 p-6">
          <Skeleton className="h-8 w-64 mb-4" />
          <Skeleton className="h-4 w-96 mb-6" />
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // No session - show start screen
  if (!session) {
    const weekStart = getCurrentWeekStart();

    return (
      <div className="flex items-center justify-center h-[calc(100vh-8rem)]">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <Calendar className="h-12 w-12 mx-auto mb-4 text-primary" />
            <h2 className="text-xl font-semibold mb-2">Weekly Review</h2>
            <p className="text-muted-foreground mb-2">
              {format(weekStart, "MMMM d, yyyy")}
            </p>
            <p className="text-sm text-muted-foreground mb-6">
              Take 15-30 minutes to review your week, confirm objectives,
              select priorities, and process your inbox.
            </p>
            <Button
              onClick={() => startSession.mutate()}
              disabled={startSession.isPending}
              size="lg"
            >
              {startSession.isPending ? "Starting..." : "Begin Review"}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Session complete - show summary
  if (session.completedAt) {
    const progress = calculateProgress(session);

    return (
      <div className="flex items-center justify-center h-[calc(100vh-8rem)]">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-600" />
            <h2 className="text-xl font-semibold mb-2">Review Complete!</h2>
            <p className="text-muted-foreground mb-2">
              Week of {format(new Date(session.weekStart), "MMMM d, yyyy")}
            </p>
            <p className="text-sm text-muted-foreground mb-6">
              Great job! You&apos;ve completed your weekly review.
              All {progress.totalSteps} steps are done.
            </p>
            <div className="space-y-3">
              <Button variant="outline" asChild className="w-full">
                <a href="/objectives">View Objectives</a>
              </Button>
              <Button variant="outline" asChild className="w-full">
                <a href="/dashboard">Go to Dashboard</a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Active session - show wizard
  return (
    <div className="flex h-[calc(100vh-8rem)] -mx-4 -my-6 sm:-mx-6 lg:-mx-8">
      {/* Sidebar */}
      <ProgressSidebar session={session} />

      {/* Content */}
      <div className="flex-1 p-6 overflow-y-auto">
        {session.currentStep === "objectives" && (
          <ObjectivesStep
            session={session}
            onComplete={handleCompleteObjectives}
          />
        )}
        {session.currentStep === "priorities" && (
          <PrioritiesStep
            session={session}
            onComplete={handleCompletePriorities}
            onBack={() => handleGoBack("priorities")}
          />
        )}
        {session.currentStep === "actions" && (
          <ActionsStep
            session={session}
            onComplete={handleCompleteActions}
            onBack={() => handleGoBack("actions")}
          />
        )}
        {session.currentStep === "inbox" && (
          <InboxStep
            session={session}
            onComplete={handleCompleteInbox}
            onBack={() => handleGoBack("inbox")}
          />
        )}
      </div>
    </div>
  );
}
