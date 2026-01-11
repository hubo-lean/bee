"use client";

import { Toaster } from "sonner";
import { CaptureProvider } from "@/components/capture/capture-provider";
import { CaptureFab } from "@/components/capture/capture-fab";

interface AuthLayoutClientProps {
  children: React.ReactNode;
}

export function AuthLayoutClient({ children }: AuthLayoutClientProps) {
  return (
    <CaptureProvider>
      {children}
      <CaptureFab />
      <Toaster position="bottom-center" richColors />
    </CaptureProvider>
  );
}
