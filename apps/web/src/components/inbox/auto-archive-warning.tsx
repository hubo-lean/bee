"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";

export function AutoArchiveWarning() {
  const { data: itemsAtRisk } = trpc.inbox.getAutoArchiveWarnings.useQuery();

  if (!itemsAtRisk || itemsAtRisk.length === 0) return null;

  return (
    <Alert variant="destructive" className="mb-4 bg-yellow-50 border-yellow-200 text-yellow-800">
      <AlertTriangle className="h-4 w-4 text-yellow-600" />
      <AlertTitle className="text-yellow-800">Items expiring soon</AlertTitle>
      <AlertDescription className="text-yellow-700">
        {itemsAtRisk.length} item{itemsAtRisk.length !== 1 ? "s" : ""} will be
        auto-archived in the next 2 days if not processed.
        <Button variant="link" className="px-1 h-auto text-yellow-700 underline" asChild>
          <Link href="/inbox?filter=expiring">View items</Link>
        </Button>
      </AlertDescription>
    </Alert>
  );
}
