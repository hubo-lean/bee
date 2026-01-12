import { useState, useCallback, useRef, useEffect } from "react";
import type { SwipeDirection } from "@/lib/constants/swipe";

interface UndoAction {
  direction: SwipeDirection;
  itemId: string;
  timestamp: Date;
}

const UNDO_WINDOW_MS = 5000; // 5 seconds

export function useUndo(onUndo: (itemId: string) => Promise<void>) {
  const [currentAction, setCurrentAction] = useState<UndoAction | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Clear timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const recordAction = useCallback(
    (direction: SwipeDirection, itemId: string) => {
      // Clear any existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Set the new action
      const action: UndoAction = {
        direction,
        itemId,
        timestamp: new Date(),
      };
      setCurrentAction(action);

      // Set expiry timeout
      timeoutRef.current = setTimeout(() => {
        setCurrentAction(null);
      }, UNDO_WINDOW_MS);
    },
    []
  );

  const executeUndo = useCallback(async () => {
    if (!currentAction) return;

    // Clear timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Execute undo
    await onUndo(currentAction.itemId);

    // Clear current action
    setCurrentAction(null);
  }, [currentAction, onUndo]);

  const clearAction = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setCurrentAction(null);
  }, []);

  return {
    currentAction,
    recordAction,
    executeUndo,
    clearAction,
  };
}
