"use client";

import { Button } from "@/components/ui/button";
import { Mail, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useState } from "react";

export function GmailSyncButton() {
  const [lastResult, setLastResult] = useState<{ synced: number } | null>(null);

  const utils = trpc.useUtils();
  const { data: status, isLoading: isLoadingStatus } =
    trpc.gmail.getSyncStatus.useQuery();

  const syncMutation = trpc.gmail.syncInbox.useMutation({
    onSuccess: (result) => {
      setLastResult(result);
      if (result.synced > 0) {
        toast.success(`Synced ${result.synced} new email${result.synced > 1 ? "s" : ""}`);
        // Invalidate inbox queries to show new items
        utils.inbox.list.invalidate();
        utils.inbox.count.invalidate();
      } else if (result.skipped > 0) {
        toast.info("No new emails to sync (all already synced)");
      } else {
        toast.info("No new emails to sync");
      }

      if (result.errors > 0) {
        toast.warning(`${result.errors} email${result.errors > 1 ? "s" : ""} failed to sync`);
      }

      // Reset result after 5 seconds
      setTimeout(() => setLastResult(null), 5000);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // Loading state
  if (isLoadingStatus) {
    return (
      <Button variant="outline" size="sm" disabled>
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        Loading...
      </Button>
    );
  }

  // Not connected state
  if (!status?.connected) {
    return (
      <Button variant="outline" size="sm" disabled title="Sign in with Google to sync emails">
        <Mail className="h-4 w-4 mr-2 text-gray-400" />
        Gmail
      </Button>
    );
  }

  // No Gmail scope state
  if (!status?.hasGmailScope) {
    return (
      <Button
        variant="outline"
        size="sm"
        disabled
        title="Re-authenticate to grant Gmail access"
      >
        <AlertCircle className="h-4 w-4 mr-2 text-yellow-500" />
        Gmail
      </Button>
    );
  }

  // Connected state
  const buttonTitle = status.lastSyncAt
    ? `Last synced: ${new Date(status.lastSyncAt).toLocaleString()}\n${status.totalSynced} emails synced total`
    : "Sync your Gmail inbox";

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => syncMutation.mutate({})}
      disabled={syncMutation.isPending}
      title={buttonTitle}
    >
      {syncMutation.isPending ? (
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
      ) : lastResult ? (
        <CheckCircle className="h-4 w-4 mr-2 text-green-500" />
      ) : (
        <Mail className="h-4 w-4 mr-2" />
      )}
      {syncMutation.isPending
        ? "Syncing..."
        : lastResult
          ? `${lastResult.synced} synced`
          : "Sync Gmail"}
    </Button>
  );
}
