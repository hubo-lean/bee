"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import {
  CardStack,
  ProgressIndicator,
  GestureHints,
  SessionComplete,
  EmptyInbox,
  ReviewSkeleton,
  UndoToast,
  CorrectionModal,
  ResumeDialog,
  type SessionStats,
  type ActionCorrection,
} from "@/components/review";
import { useSessionPersistence } from "@/lib/hooks/use-session-persistence";
import { type SwipeDirection } from "@/lib/constants/swipe";
import type { InboxItem } from "@packages/db";

interface UndoAction {
  itemId: string;
  action: string;
  previousState: {
    status: string;
    extractedActions?: Record<string, unknown>[];
  };
}

export default function DailyReviewPage() {
  const router = useRouter();
  const utils = trpc.useUtils();

  const { data: session, isLoading: sessionLoading } =
    trpc.review.getActiveSession.useQuery();

  const startSession = trpc.review.startSession.useMutation({
    onSuccess: () => {
      utils.review.getActiveSession.invalidate();
    },
  });

  const recordSwipe = trpc.review.recordSwipe.useMutation({
    onSuccess: () => {
      utils.review.getActiveSession.invalidate();
    },
  });

  const undoSwipeMutation = trpc.review.undoSwipe.useMutation({
    onSuccess: () => {
      utils.review.getActiveSession.invalidate();
    },
  });

  const completeSessionMutation = trpc.review.completeSession.useMutation({
    onSuccess: () => {
      utils.review.getActiveSession.invalidate();
    },
  });

  const submitCorrection = trpc.review.submitCorrection.useMutation({
    onSuccess: () => {
      utils.review.getActiveSession.invalidate();
    },
  });

  const [undoAction, setUndoAction] = useState<UndoAction | null>(null);
  const [sessionStartTime] = useState<Date>(new Date());
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);
  const [correctionItem, setCorrectionItem] = useState<InboxItem | null>(null);
  const [showResumeDialog, setShowResumeDialog] = useState(false);
  const [hasCheckedResume, setHasCheckedResume] = useState(false);

  // Use session persistence for auto-save
  const { saveSession } = useSessionPersistence(session?.id);

  // Check if we should show resume dialog on first load
  useEffect(() => {
    if (!sessionLoading && session && !hasCheckedResume) {
      setHasCheckedResume(true);
      // Show resume dialog if session has progress
      if (session.currentIndex > 0 && !session.completedAt) {
        setShowResumeDialog(true);
      }
    }
  }, [sessionLoading, session, hasCheckedResume]);

  // Start session if none exists
  useEffect(() => {
    if (!sessionLoading && !session && !startSession.isPending) {
      startSession.mutate({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionLoading, session]);

  // Auto-save session activity periodically
  useEffect(() => {
    if (session?.id) {
      saveSession({ lastActivityAt: new Date() });
    }
  }, [session?.id, session?.currentIndex, saveSession]);

  // Calculate stats from session actions
  const calculateStats = useCallback((): SessionStats => {
    if (!session) {
      return { agreed: 0, disagreed: 0, urgent: 0, hidden: 0, total: 0 };
    }

    const actions = (session.actions as unknown as Array<{
      action: string;
      undone?: boolean;
    }>) || [];

    const activeActions = actions.filter((a) => !a.undone);

    return {
      agreed: activeActions.filter((a) => a.action === "agree").length,
      disagreed: activeActions.filter((a) => a.action === "disagree").length,
      urgent: activeActions.filter((a) => a.action === "urgent").length,
      hidden: activeActions.filter((a) => a.action === "hide").length,
      total: session.itemIds.length,
    };
  }, [session]);

  const handleSwipe = async (direction: SwipeDirection, itemId: string) => {
    if (!session) return;

    try {
      const result = await recordSwipe.mutateAsync({
        sessionId: session.id,
        itemId,
        direction,
      });

      if (result.openModal === "correction") {
        // Open correction modal for disagree swipes
        const item = session.items.find((i) => i.id === itemId);
        if (item) {
          setCorrectionItem(item);
          setShowCorrectionModal(true);
        }
      } else {
        // Show undo toast for other actions
        setUndoAction({
          itemId,
          action: result.action,
          previousState: result.previousState,
        });
      }
    } catch (error) {
      console.error("Failed to record swipe:", error);
    }
  };

  const handleUndo = async () => {
    if (!session || !undoAction) return;

    try {
      await undoSwipeMutation.mutateAsync({
        sessionId: session.id,
        itemId: undoAction.itemId,
      });
      setUndoAction(null);
    } catch (error) {
      console.error("Failed to undo:", error);
    }
  };

  const handleComplete = async () => {
    if (!session) return;

    try {
      await completeSessionMutation.mutateAsync({
        sessionId: session.id,
      });
    } catch (error) {
      console.error("Failed to complete session:", error);
    }
  };

  const handleCorrectionSubmit = async (correction: {
    inboxItemId: string;
    sessionId: string;
    correctionType: "fix_now" | "weekly_review";
    correctedCategory?: string;
    correctedActions?: ActionCorrection[];
    userReason?: string;
  }) => {
    try {
      await submitCorrection.mutateAsync(correction);
      // After correction, show feedback
      setUndoAction({
        itemId: correction.inboxItemId,
        action: correction.correctionType === "weekly_review" ? "disagree" : "disagree",
        previousState: { status: "pending" },
      });
    } catch (error) {
      console.error("Failed to submit correction:", error);
    }
  };

  // Loading state
  if (sessionLoading || startSession.isPending) {
    return <ReviewSkeleton />;
  }

  // Empty state - no items to review
  if (!session?.items?.length) {
    return (
      <div className="flex flex-col h-[100dvh]">
        <header className="flex items-center justify-between p-4 border-b">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/dashboard">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <h1 className="font-semibold">Daily Review</h1>
          <div className="w-8" />
        </header>
        <div className="flex-1">
          <EmptyInbox />
        </div>
      </div>
    );
  }

  const stats = calculateStats();
  const isComplete = session.currentIndex >= session.items.length;

  // Completion state
  if (isComplete || session.completedAt) {
    const duration = session.completedAt
      ? new Date(session.completedAt).getTime() -
        new Date(session.startedAt).getTime()
      : Date.now() - sessionStartTime.getTime();

    return (
      <div className="flex flex-col h-[100dvh]">
        <SessionComplete
          stats={stats}
          duration={duration}
          onDone={() => {
            handleComplete();
            router.push("/dashboard");
          }}
          onViewReceipts={() => {
            handleComplete();
            router.push("/inbox?tab=receipts");
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[100dvh]">
      {/* Header */}
      <header className="flex items-center justify-between p-4 border-b shrink-0">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <h1 className="font-semibold">Daily Review</h1>
        <span className="text-sm text-muted-foreground">
          {session.currentIndex + 1} of {session.items.length}
        </span>
      </header>

      {/* Progress */}
      <div className="px-4 py-2 shrink-0">
        <ProgressIndicator
          current={session.currentIndex}
          total={session.items.length}
          stats={stats}
        />
      </div>

      {/* Card Stack */}
      <div className="flex-1 px-4 py-6 min-h-0">
        <CardStack
          items={session.items}
          currentIndex={session.currentIndex}
          onSwipe={handleSwipe}
        />
      </div>

      {/* Gesture Hints - show for first 3 cards */}
      <div className="shrink-0 pb-[env(safe-area-inset-bottom)]">
        <GestureHints showHints={session.currentIndex < 3} />
      </div>

      {/* Undo Toast */}
      {undoAction && (
        <UndoToast
          action={undoAction.action as "agree" | "disagree" | "urgent" | "hide"}
          onUndo={handleUndo}
          onExpire={() => setUndoAction(null)}
        />
      )}

      {/* Correction Modal */}
      <CorrectionModal
        open={showCorrectionModal}
        item={correctionItem}
        sessionId={session.id}
        onClose={() => {
          setShowCorrectionModal(false);
          setCorrectionItem(null);
        }}
        onSubmit={handleCorrectionSubmit}
      />

      {/* Resume Dialog */}
      <ResumeDialog
        open={showResumeDialog}
        startedAt={new Date(session.startedAt)}
        currentIndex={session.currentIndex}
        totalItems={session.items.length}
        onResume={() => setShowResumeDialog(false)}
        onStartFresh={async () => {
          setShowResumeDialog(false);
          await startSession.mutateAsync({ forceNew: true });
        }}
      />
    </div>
  );
}
