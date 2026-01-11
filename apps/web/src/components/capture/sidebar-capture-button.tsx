"use client";

import { Plus } from "lucide-react";
import { useCapture } from "./capture-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SidebarCaptureButtonProps {
  className?: string;
}

export function SidebarCaptureButton({ className }: SidebarCaptureButtonProps) {
  const { openCapture } = useCapture();

  return (
    <Button
      onClick={openCapture}
      className={cn("w-full justify-start gap-3", className)}
      variant="default"
    >
      <Plus className="h-5 w-5" aria-hidden="true" />
      Quick Capture
    </Button>
  );
}
