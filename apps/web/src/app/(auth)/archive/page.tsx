"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Archive, FolderKanban, RotateCcw, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { BankruptcyDialog } from "@/components/inbox/bankruptcy-dialog";

type InboxFilter = "all" | "unprocessed" | "bankruptcy";

interface Tag {
  type: string;
  value: string;
  confidence: number;
}

export default function ArchivePage() {
  const [inboxFilter, setInboxFilter] = useState<InboxFilter>("all");
  const [showBankruptcyDialog, setShowBankruptcyDialog] = useState(false);
  const utils = trpc.useUtils();

  const { data: paraArchived, isLoading: paraLoading } = trpc.para.listArchived.useQuery();
  const { data: inboxArchived, isLoading: inboxLoading } = trpc.inbox.getArchived.useQuery({
    filter: inboxFilter,
    limit: 50,
  });
  const { data: pendingCount } = trpc.inbox.getPendingCount.useQuery();

  const restorePara = trpc.para.restoreFromArchive.useMutation({
    onSuccess: () => {
      utils.para.listArchived.invalidate();
      utils.para.listProjects.invalidate();
    },
  });

  const restoreInbox = trpc.inbox.restore.useMutation({
    onSuccess: () => {
      utils.inbox.getArchived.invalidate();
      utils.inbox.list.invalidate();
      utils.inbox.count.invalidate();
    },
  });

  const isLoading = paraLoading || inboxLoading;

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  const getItemBadge = (tags: Tag[]) => {
    const isUnprocessed = tags?.some((t) => t.value.startsWith("Unprocessed"));
    const isBankruptcy = tags?.some((t) => t.value.startsWith("Bankruptcy"));

    if (isUnprocessed) {
      return (
        <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
          Auto-archived
        </Badge>
      );
    }
    if (isBankruptcy) {
      return (
        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
          Bankruptcy
        </Badge>
      );
    }
    return null;
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Archive className="h-6 w-6" />
            Archive
          </h1>
          <p className="text-muted-foreground">
            Archived items are hidden but still searchable
          </p>
        </div>
        {(pendingCount ?? 0) > 0 && (
          <Button
            variant="outline"
            className="text-red-600 border-red-200 hover:bg-red-50"
            onClick={() => setShowBankruptcyDialog(true)}
          >
            <AlertTriangle className="h-4 w-4 mr-2" />
            Declare Bankruptcy
          </Button>
        )}
      </div>

      {/* Archive Stats */}
      {inboxArchived && (
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{inboxArchived.total}</div>
              <p className="text-sm text-muted-foreground">Total archived</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-yellow-600">
                {inboxArchived.unprocessed}
              </div>
              <p className="text-sm text-muted-foreground">Auto-archived</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-red-600">
                {inboxArchived.bankruptcy}
              </div>
              <p className="text-sm text-muted-foreground">From bankruptcy</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabs for PARA vs Inbox */}
      <Tabs defaultValue="inbox">
        <TabsList>
          <TabsTrigger value="inbox">
            Inbox Items
            <Badge variant="secondary" className="ml-2">
              {inboxArchived?.total ?? 0}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="para">
            Projects
            <Badge variant="secondary" className="ml-2">
              {paraArchived?.projects?.length ?? 0}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="inbox" className="mt-4">
          {/* Filter */}
          <div className="flex items-center gap-4 mb-4">
            <Select
              value={inboxFilter}
              onValueChange={(v) => setInboxFilter(v as InboxFilter)}
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All archived</SelectItem>
                <SelectItem value="unprocessed">Auto-archived</SelectItem>
                <SelectItem value="bankruptcy">Bankruptcy</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Inbox Items */}
          {inboxArchived?.items && inboxArchived.items.length > 0 ? (
            <div className="space-y-2">
              {inboxArchived.items.map((item) => (
                <Card key={item.id} className="bg-muted/30">
                  <CardContent className="py-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="line-clamp-2">{item.content}</p>
                        <div className="flex items-center gap-2 mt-2 text-xs">
                          <span className="text-muted-foreground">
                            Archived{" "}
                            {item.archivedAt
                              ? format(new Date(item.archivedAt), "MMM d, yyyy")
                              : "recently"}
                          </span>
                          {getItemBadge(item.tags as unknown as Tag[])}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => restoreInbox.mutate({ id: item.id })}
                        disabled={restoreInbox.isPending}
                      >
                        <RotateCcw className="h-4 w-4 mr-1" />
                        Restore
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <Archive className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground">No archived inbox items</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="para" className="mt-4">
          {/* Archived Projects */}
          {paraArchived?.projects && paraArchived.projects.length > 0 ? (
            <div className="space-y-2">
              {paraArchived.projects.map((project) => (
                <Card key={project.id}>
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <FolderKanban className="h-4 w-4" />
                          <p className="font-medium">{project.name}</p>
                        </div>
                        {project.archivedAt && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Archived {format(new Date(project.archivedAt), "MMM d, yyyy")}
                          </p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          restorePara.mutate({ type: "project", id: project.id })
                        }
                        disabled={restorePara.isPending}
                      >
                        <RotateCcw className="h-4 w-4 mr-1" />
                        Restore
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <FolderKanban className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground">No archived projects</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Bankruptcy Dialog */}
      <BankruptcyDialog
        open={showBankruptcyDialog}
        onOpenChange={setShowBankruptcyDialog}
        onSuccess={() => {
          utils.inbox.getArchived.invalidate();
          utils.inbox.count.invalidate();
          utils.inbox.list.invalidate();
          utils.inbox.getPendingCount.invalidate();
        }}
      />
    </div>
  );
}
