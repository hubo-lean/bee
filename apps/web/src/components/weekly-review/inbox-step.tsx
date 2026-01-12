"use client";

import { Inbox, CheckCircle, AlertCircle, Archive, FolderKanban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import type {
  WeeklyReviewSessionWithData,
  InboxStepData,
} from "@/server/services/weekly-review.service";

interface InboxStepProps {
  session: WeeklyReviewSessionWithData;
  onComplete: (data: InboxStepData) => void;
  onBack: () => void;
}

export function InboxStep({ onComplete, onBack }: InboxStepProps) {
  const utils = trpc.useUtils();

  // Use combined endpoint for parallel data fetching (eliminates waterfall)
  const { data: inboxStepData, isLoading } =
    trpc.weeklyReview.getInboxStepData.useQuery();

  // Destructure data from combined endpoint
  const needsReview = inboxStepData?.needsReview;
  const disagreements = inboxStepData?.disagreements;
  const projects = inboxStepData?.projects;
  const areas = inboxStepData?.areas;

  const archiveItem = trpc.weeklyReview.archiveItem.useMutation({
    // Optimistic update: remove item immediately before server responds
    onMutate: async ({ id }) => {
      // Cancel outgoing fetches to prevent race conditions
      await utils.weeklyReview.getInboxStepData.cancel();

      // Snapshot current data for rollback
      const previousData = utils.weeklyReview.getInboxStepData.getData();

      // Optimistically remove item from both queues
      utils.weeklyReview.getInboxStepData.setData(undefined, (old) =>
        old
          ? {
              ...old,
              needsReview: old.needsReview.filter((item) => item.id !== id),
              disagreements: old.disagreements.filter((item) => item.id !== id),
            }
          : old
      );

      return { previousData };
    },
    // Rollback on error
    onError: (_err, _variables, context) => {
      if (context?.previousData) {
        utils.weeklyReview.getInboxStepData.setData(undefined, context.previousData);
      }
    },
    // Refetch after mutation settles for consistency
    onSettled: () => {
      utils.weeklyReview.getInboxStepData.invalidate();
    },
  });

  const fileItem = trpc.para.fileItem.useMutation({
    // Optimistic update: remove item immediately before server responds
    onMutate: async ({ inboxItemId }) => {
      // Cancel outgoing fetches to prevent race conditions
      await utils.weeklyReview.getInboxStepData.cancel();

      // Snapshot current data for rollback
      const previousData = utils.weeklyReview.getInboxStepData.getData();

      // Optimistically remove item from both queues
      utils.weeklyReview.getInboxStepData.setData(undefined, (old) =>
        old
          ? {
              ...old,
              needsReview: old.needsReview.filter((item) => item.id !== inboxItemId),
              disagreements: old.disagreements.filter((item) => item.id !== inboxItemId),
            }
          : old
      );

      return { previousData };
    },
    // Rollback on error
    onError: (_err, _variables, context) => {
      if (context?.previousData) {
        utils.weeklyReview.getInboxStepData.setData(undefined, context.previousData);
      }
    },
    // Refetch after mutation settles for consistency
    onSettled: () => {
      utils.weeklyReview.getInboxStepData.invalidate();
    },
  });

  const archiveAll = trpc.weeklyReview.archiveAll.useMutation({
    // Optimistic update: clear entire queue immediately
    onMutate: async ({ queue }) => {
      await utils.weeklyReview.getInboxStepData.cancel();

      const previousData = utils.weeklyReview.getInboxStepData.getData();

      // Optimistically clear the target queue
      utils.weeklyReview.getInboxStepData.setData(undefined, (old) =>
        old
          ? {
              ...old,
              needsReview: queue === "needsReview" ? [] : old.needsReview,
              disagreements: queue === "disagreements" ? [] : old.disagreements,
            }
          : old
      );

      return { previousData };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousData) {
        utils.weeklyReview.getInboxStepData.setData(undefined, context.previousData);
      }
    },
    onSettled: () => {
      utils.weeklyReview.getInboxStepData.invalidate();
    },
  });

  const needsReviewCount = needsReview?.length ?? 0;
  const disagreementsCount = disagreements?.length ?? 0;
  const totalItems = needsReviewCount + disagreementsCount;
  const allProcessed = totalItems === 0;

  const handleArchiveItem = (id: string) => {
    archiveItem.mutate({ id });
  };

  const handleFileItem = (
    itemId: string,
    destination: { type: "project" | "area"; id: string }
  ) => {
    fileItem.mutate({
      inboxItemId: itemId,
      destination,
      createNote: true,
    });
  };

  const handleArchiveAll = (queue: "needsReview" | "disagreements") => {
    archiveAll.mutate({ queue });
  };

  const handleComplete = () => {
    onComplete({
      needsReview: { processed: 0, remaining: needsReviewCount },
      disagreements: { processed: 0, remaining: disagreementsCount },
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-7 w-48 mb-2" />
          <Skeleton className="h-5 w-80" />
        </div>
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-32 w-full rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold mb-2">Process Inbox</h2>
        <p className="text-muted-foreground">
          Review items that need your attention. Mandatory queues must reach
          zero to complete the weekly review.
        </p>
      </div>

      {/* Overall Progress */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Inbox className="h-4 w-4" />
            Inbox Progress
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Progress value={allProcessed ? 100 : 0} className="h-2 mb-2" />
          <p className="text-sm text-muted-foreground">
            {totalItems} items remaining
          </p>
        </CardContent>
      </Card>

      {/* Queue Tabs */}
      <Tabs defaultValue="needsReview">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="needsReview" className="relative">
            Needs Review
            <Badge
              variant={needsReviewCount > 0 ? "destructive" : "secondary"}
              className="ml-2"
            >
              {needsReviewCount}
            </Badge>
            {needsReviewCount === 0 && (
              <CheckCircle className="h-4 w-4 ml-1 text-green-500" />
            )}
          </TabsTrigger>
          <TabsTrigger value="disagreements" className="relative">
            Disagreements
            <Badge
              variant={disagreementsCount > 0 ? "destructive" : "secondary"}
              className="ml-2"
            >
              {disagreementsCount}
            </Badge>
            {disagreementsCount === 0 && (
              <CheckCircle className="h-4 w-4 ml-1 text-green-500" />
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="needsReview" className="mt-4 space-y-4">
          {needsReviewCount === 0 ? (
            <Card className="border-green-200 bg-green-50">
              <CardContent className="py-8 text-center">
                <CheckCircle className="h-12 w-12 mx-auto mb-3 text-green-500" />
                <p className="text-green-700">All items reviewed! Great job.</p>
              </CardContent>
            </Card>
          ) : (
            <>
              {needsReview?.map((item) => (
                <QueueItemCard
                  key={item.id}
                  item={item}
                  projects={projects}
                  areas={areas}
                  onArchive={() => handleArchiveItem(item.id)}
                  onFile={(dest) => handleFileItem(item.id, dest)}
                />
              ))}

              {/* Bulk Actions */}
              <div className="flex items-center gap-4 py-4 border-t">
                <span className="text-sm text-muted-foreground">Bulk:</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleArchiveAll("needsReview")}
                  disabled={archiveAll.isPending}
                >
                  <Archive className="h-4 w-4 mr-1" />
                  Archive All ({needsReviewCount})
                </Button>
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="disagreements" className="mt-4 space-y-4">
          {disagreementsCount === 0 ? (
            <Card className="border-green-200 bg-green-50">
              <CardContent className="py-8 text-center">
                <CheckCircle className="h-12 w-12 mx-auto mb-3 text-green-500" />
                <p className="text-green-700">No disagreements to process.</p>
              </CardContent>
            </Card>
          ) : (
            <>
              {disagreements?.map((item) => (
                <QueueItemCard
                  key={item.id}
                  item={item}
                  projects={projects}
                  areas={areas}
                  onArchive={() => handleArchiveItem(item.id)}
                  onFile={(dest) => handleFileItem(item.id, dest)}
                  showDisagreement
                />
              ))}

              {/* Bulk Actions */}
              <div className="flex items-center gap-4 py-4 border-t">
                <span className="text-sm text-muted-foreground">Bulk:</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleArchiveAll("disagreements")}
                  disabled={archiveAll.isPending}
                >
                  <Archive className="h-4 w-4 mr-1" />
                  Archive All ({disagreementsCount})
                </Button>
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* Completion Status */}
      <Card
        className={cn(
          "transition-colors",
          allProcessed
            ? "border-green-500 bg-green-50"
            : "border-yellow-500 bg-yellow-50"
        )}
      >
        <CardContent className="py-4">
          {allProcessed ? (
            <div className="flex items-center gap-2 text-green-700">
              <CheckCircle className="h-5 w-5" />
              <span>All mandatory queues complete!</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-yellow-700">
              <AlertCircle className="h-5 w-5" />
              <span>{totalItems} items remaining in mandatory queues</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between pt-4 border-t">
        <Button variant="outline" onClick={onBack}>
          ← Back
        </Button>
        <Button onClick={handleComplete} variant={allProcessed ? "default" : "outline"}>
          {allProcessed ? "Complete Review" : "Skip & Complete"}
        </Button>
      </div>
    </div>
  );
}

interface QueueItemCardProps {
  item: {
    id: string;
    content: string;
    aiClassification?: unknown;
  };
  projects?: Array<{ id: string; name: string; color?: string | null }>;
  areas?: Array<{ id: string; name: string; icon?: string | null }>;
  onArchive: () => void;
  onFile: (destination: { type: "project" | "area"; id: string }) => void;
  showDisagreement?: boolean;
}

function QueueItemCard({
  item,
  projects,
  areas,
  onArchive,
  onFile,
  showDisagreement,
}: QueueItemCardProps) {
  const classification = item.aiClassification as {
    category?: string;
    confidence?: number;
    reasoning?: string;
  } | null;

  return (
    <Card>
      <CardContent className="py-4 space-y-3">
        <p className="line-clamp-3">{item.content}</p>

        {classification && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>AI suggests:</span>
            <Badge variant="outline">{classification.category || "unknown"}</Badge>
            <span>{Math.round((classification.confidence || 0) * 100)}%</span>
          </div>
        )}

        {showDisagreement && (
          <p className="text-sm text-orange-600">
            You disagreed with this classification during daily triage.
          </p>
        )}

        <div className="flex flex-wrap gap-2 pt-2">
          {projects && projects.length > 0 && (
            <div className="flex gap-1">
              {projects.slice(0, 3).map((project) => (
                <Button
                  key={project.id}
                  variant="outline"
                  size="sm"
                  onClick={() => onFile({ type: "project", id: project.id })}
                >
                  <FolderKanban
                    className="h-3 w-3 mr-1"
                    style={project.color ? { color: project.color } : undefined}
                  />
                  {project.name}
                </Button>
              ))}
            </div>
          )}

          {areas && areas.length > 0 && (
            <div className="flex gap-1">
              {areas.slice(0, 2).map((area) => (
                <Button
                  key={area.id}
                  variant="outline"
                  size="sm"
                  onClick={() => onFile({ type: "area", id: area.id })}
                >
                  {area.icon && <span className="mr-1">{area.icon}</span>}
                  {area.name}
                </Button>
              ))}
            </div>
          )}

          <Button variant="ghost" size="sm" onClick={onArchive}>
            <Archive className="h-4 w-4 mr-1" />
            Archive
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
