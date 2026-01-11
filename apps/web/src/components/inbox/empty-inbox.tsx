"use client";

import { Inbox, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCapture } from "@/components/capture/capture-provider";

export function EmptyInbox() {
  const { openCapture } = useCapture();

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gray-100">
        <Inbox className="h-10 w-10 text-gray-400" aria-hidden="true" />
      </div>

      <h2 className="mt-6 text-xl font-semibold text-gray-900">
        Your inbox is empty
      </h2>

      <p className="mt-2 max-w-sm text-sm text-gray-500">
        Capture your first thought, image, or voice note to get started.
        Everything you capture will appear here for processing.
      </p>

      <Button onClick={openCapture} className="mt-6">
        <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
        Capture something
      </Button>
    </div>
  );
}
