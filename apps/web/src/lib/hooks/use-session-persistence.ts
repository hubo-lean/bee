"use client";

import { useEffect, useCallback, useRef } from "react";
import { trpc } from "@/lib/trpc";

/**
 * Hook for persisting review session state with auto-save
 * - Debounced save on changes
 * - Immediate save on visibility change (tab switch, app background)
 * - Beacon save on page unload
 */
export function useSessionPersistence(sessionId: string | null | undefined) {
  const updateSession = trpc.review.updateSession.useMutation();
  const pendingSaveRef = useRef<{
    currentIndex?: number;
    lastActivityAt?: Date;
  } | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // Flush pending save immediately
  const flushSave = useCallback(() => {
    if (sessionId && pendingSaveRef.current) {
      updateSession.mutate({
        sessionId,
        ...pendingSaveRef.current,
      });
      pendingSaveRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, [sessionId, updateSession]);

  // Debounced save
  const saveSession = useCallback(
    (updates: { currentIndex?: number; lastActivityAt?: Date }) => {
      if (!sessionId) return;

      // Merge updates
      pendingSaveRef.current = {
        ...pendingSaveRef.current,
        ...updates,
      };

      // Debounce save
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        flushSave();
      }, 500);
    },
    [sessionId, flushSave]
  );

  // Save on visibility change
  useEffect(() => {
    if (!sessionId) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        flushSave();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [sessionId, flushSave]);

  // Beacon save on page unload
  useEffect(() => {
    if (!sessionId) return;

    const handleBeforeUnload = () => {
      // Use beacon for reliable save before page closes
      const payload = JSON.stringify({
        sessionId,
        lastActivityAt: new Date().toISOString(),
      });
      navigator.sendBeacon("/api/review/save-session", payload);
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [sessionId]);

  return { saveSession, flushSave };
}
