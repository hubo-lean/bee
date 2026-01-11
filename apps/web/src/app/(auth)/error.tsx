"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function AuthError({ error, reset }: ErrorProps) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error("Auth error:", error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
        <AlertTriangle className="h-8 w-8 text-red-600" aria-hidden="true" />
      </div>
      <h2 className="mt-6 text-2xl font-bold text-gray-900">
        Something went wrong
      </h2>
      <p className="mt-2 max-w-md text-sm text-gray-500">
        An unexpected error occurred. Please try again or contact support if the
        problem persists.
      </p>
      <Button onClick={reset} className="mt-6">
        Try again
      </Button>
    </div>
  );
}
