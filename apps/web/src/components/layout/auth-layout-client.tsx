"use client";

import { Toaster } from "sonner";
import { CaptureProvider } from "@/components/capture/capture-provider";
import { CaptureFab } from "@/components/capture/capture-fab";
import { MobileNavProvider } from "@/components/navigation/mobile-nav-provider";

interface AuthLayoutClientProps {
  children: React.ReactNode;
}

export function AuthLayoutClient({ children }: AuthLayoutClientProps) {
  return (
    <MobileNavProvider>
      <CaptureProvider>
        {children}
        <CaptureFab />
        <Toaster position="bottom-center" richColors />
      </CaptureProvider>
    </MobileNavProvider>
  );
}
