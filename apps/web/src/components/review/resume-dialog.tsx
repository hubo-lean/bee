"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ResumeDialogProps {
  open: boolean;
  startedAt: Date;
  currentIndex: number;
  totalItems: number;
  onResume: () => void;
  onStartFresh: () => void;
}

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) {
    return "just now";
  } else if (diffMins < 60) {
    return `${diffMins} minute${diffMins === 1 ? "" : "s"} ago`;
  } else if (diffHours < 24) {
    return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  } else {
    return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
  }
}

export function ResumeDialog({
  open,
  startedAt,
  currentIndex,
  totalItems,
  onResume,
  onStartFresh,
}: ResumeDialogProps) {
  const remaining = totalItems - currentIndex;

  return (
    <AlertDialog open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Resume previous session?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2">
              <p>
                You have an incomplete review session from{" "}
                <span className="font-medium">{formatRelativeTime(startedAt)}</span>.
              </p>
              <p>
                <span className="font-medium">{currentIndex}</span> of{" "}
                <span className="font-medium">{totalItems}</span> items processed
                {remaining > 0 && (
                  <span className="text-muted-foreground">
                    {" "}({remaining} remaining)
                  </span>
                )}
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onStartFresh}>
            Start Fresh
          </AlertDialogCancel>
          <AlertDialogAction onClick={onResume}>Resume</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
