"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";

interface BankruptcyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (count: number) => void;
}

export function BankruptcyDialog({ open, onOpenChange, onSuccess }: BankruptcyDialogProps) {
  const [confirmText, setConfirmText] = useState("");
  const utils = trpc.useUtils();

  const { data: itemCount } = trpc.inbox.getPendingCount.useQuery();
  const declareBankruptcy = trpc.inbox.declareBankruptcy.useMutation({
    onSuccess: (data) => {
      utils.inbox.count.invalidate();
      utils.inbox.list.invalidate();
      utils.inbox.getArchived.invalidate();
      onOpenChange(false);
      setConfirmText("");
      onSuccess?.(data.archived);
    },
  });

  const handleConfirm = async () => {
    if (confirmText !== "RESET") return;
    await declareBankruptcy.mutateAsync();
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setConfirmText("");
    }
    onOpenChange(newOpen);
  };

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-5 w-5" />
            Declare Inbox Bankruptcy
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4">
              <p>
                This will archive <strong>{itemCount ?? 0}</strong> items from your inbox.
                This action cannot be undone, but items will remain searchable in the Archive.
              </p>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-yellow-800 text-sm font-medium">
                  When to use this:
                </p>
                <ul className="text-yellow-700 text-sm mt-2 list-disc list-inside space-y-1">
                  <li>You&apos;ve fallen far behind on processing</li>
                  <li>Most items are no longer relevant</li>
                  <li>You want a fresh start without guilt</li>
                </ul>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm" className="text-foreground">
                  Type <strong>RESET</strong> to confirm:
                </Label>
                <Input
                  id="confirm"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
                  placeholder="Type RESET"
                  autoComplete="off"
                />
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={confirmText !== "RESET" || declareBankruptcy.isPending}
            className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
          >
            {declareBankruptcy.isPending ? "Archiving..." : "Declare Bankruptcy"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
