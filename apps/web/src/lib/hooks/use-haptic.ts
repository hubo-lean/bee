import { useCallback } from "react";

type HapticType = "light" | "medium" | "heavy";

const HAPTIC_PATTERNS: Record<HapticType, number[]> = {
  light: [10],
  medium: [20],
  heavy: [30, 10, 30],
};

/**
 * Hook for triggering haptic feedback on supported devices
 */
export function useHaptic() {
  const trigger = useCallback((type: HapticType = "light") => {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      try {
        navigator.vibrate(HAPTIC_PATTERNS[type]);
      } catch {
        // Silently fail if vibration not supported
      }
    }
  }, []);

  const isSupported =
    typeof navigator !== "undefined" && "vibrate" in navigator;

  return { trigger, isSupported };
}
