"use client";

import { useState, useCallback, CSSProperties } from "react";
import { useDrag } from "@use-gesture/react";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  SWIPE_THRESHOLD,
  VELOCITY_THRESHOLD,
  SPRING_CONFIG,
  EXIT_ANIMATIONS,
  SWIPE_FEEDBACK,
  type SwipeDirection,
  type Category,
} from "@/lib/constants/swipe";
import { useHaptic } from "@/lib/hooks/use-haptic";
import { ConfidenceBadge } from "./confidence-badge";
import { CategoryBadge } from "./category-badge";
import { SwipeFeedback } from "./swipe-feedback";
import {
  Camera,
  Keyboard,
  Mic,
  Mail,
  Forward,
  Globe,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

// Types matching the InboxItem structure
interface AIClassification {
  category: Category;
  confidence: number;
  reasoning?: string;
}

export interface InboxItemData {
  id: string;
  type: string;
  content: string;
  source: string;
  aiClassification: AIClassification | null;
  tags: string[];
  createdAt: Date | string;
}

export interface SwipeCardProps {
  item: InboxItemData;
  onSwipe: (direction: SwipeDirection) => void;
  onSwipeStart?: () => void;
  onSwipeEnd?: () => void;
  isActive: boolean;
  stackIndex?: number;
  style?: CSSProperties;
}

const SOURCE_ICONS: Record<string, typeof Camera> = {
  camera: Camera,
  manual: Keyboard,
  voice: Mic,
  email: Mail,
  forward: Forward,
  web: Globe,
};

function getSwipeDirection(
  mx: number,
  my: number
): SwipeDirection | null {
  const absX = Math.abs(mx);
  const absY = Math.abs(my);

  // Determine if swipe is primarily horizontal or vertical
  if (absX > absY) {
    // Horizontal swipe
    if (absX < SWIPE_THRESHOLD) return null;
    return mx > 0 ? "right" : "left";
  } else {
    // Vertical swipe
    if (absY < SWIPE_THRESHOLD) return null;
    return my > 0 ? "down" : "up";
  }
}

export function SwipeCard({
  item,
  onSwipe,
  onSwipeStart,
  onSwipeEnd,
  isActive,
  stackIndex: _stackIndex = 0,
  style,
}: SwipeCardProps) {
  // stackIndex reserved for future stacked card visual effects
  void _stackIndex;
  const [isExiting, setIsExiting] = useState(false);
  const [exitDirection, setExitDirection] = useState<SwipeDirection | null>(null);
  const [wasOverThreshold, setWasOverThreshold] = useState(false);

  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const { trigger: triggerHaptic } = useHaptic();

  // Calculate rotation based on x movement
  const rotation = useTransform(x, [-200, 0, 200], [-15, 0, 15]);

  // Calculate feedback opacity based on drag distance
  const [feedbackDirection, setFeedbackDirection] = useState<SwipeDirection | null>(null);
  const [feedbackOpacity, setFeedbackOpacity] = useState(0);

  const resetPosition = useCallback(() => {
    animate(x, 0, SPRING_CONFIG);
    animate(y, 0, SPRING_CONFIG);
    setFeedbackDirection(null);
    setFeedbackOpacity(0);
    setWasOverThreshold(false);
  }, [x, y]);

  const handleSwipeComplete = useCallback(
    (direction: SwipeDirection) => {
      setIsExiting(true);
      setExitDirection(direction);
      triggerHaptic("medium");

      // Animate exit
      const exitAnim = EXIT_ANIMATIONS[direction];
      Promise.all([
        animate(x, exitAnim.x, { ...SPRING_CONFIG, duration: 0.3 }),
        animate(y, exitAnim.y, { ...SPRING_CONFIG, duration: 0.3 }),
      ]).then(() => {
        onSwipe(direction);
      });
    },
    [x, y, onSwipe, triggerHaptic]
  );

  const bindGesture = useDrag(
    ({ movement: [mx, my], velocity: [vx, vy], active, first, last }) => {
      if (!isActive) return;

      if (first) {
        onSwipeStart?.();
      }

      if (active) {
        x.set(mx);
        y.set(my);

        // Determine current swipe direction for feedback
        const direction = getSwipeDirection(mx, my);
        setFeedbackDirection(direction);

        // Calculate feedback opacity
        const absX = Math.abs(mx);
        const absY = Math.abs(my);
        const distance = Math.max(absX, absY);
        const opacity = Math.min(distance / (SWIPE_THRESHOLD * 2), 1);
        setFeedbackOpacity(opacity);

        // Check if we crossed threshold for haptic feedback
        const isOverThreshold = distance >= SWIPE_THRESHOLD;
        if (isOverThreshold && !wasOverThreshold) {
          triggerHaptic("light");
          setWasOverThreshold(true);
        } else if (!isOverThreshold && wasOverThreshold) {
          setWasOverThreshold(false);
        }
      }

      if (last) {
        onSwipeEnd?.();

        const absX = Math.abs(mx);
        const absY = Math.abs(my);
        const isHorizontal = absX > absY;
        const distance = isHorizontal ? absX : absY;
        const speed = isHorizontal ? Math.abs(vx) : Math.abs(vy);

        // Check if swipe meets threshold
        if (distance > SWIPE_THRESHOLD || speed > VELOCITY_THRESHOLD) {
          const direction = getSwipeDirection(mx, my);
          if (direction) {
            handleSwipeComplete(direction);
            return;
          }
        }

        // Return to center if swipe incomplete
        resetPosition();
      }
    },
    {
      filterTaps: true,
      enabled: isActive && !isExiting,
    }
  );

  // Extract gesture handlers for compatibility with framer-motion
  const gestureHandlers = bindGesture();

  // Get source icon
  const SourceIcon = SOURCE_ICONS[item.type] || SOURCE_ICONS.manual;

  // Format timestamp
  const timeAgo = formatDistanceToNow(new Date(item.createdAt), {
    addSuffix: false,
  });

  // Truncate content for preview
  const contentPreview = item.content.length > 150
    ? item.content.substring(0, 150) + "..."
    : item.content;

  // Parse tags
  const tags = Array.isArray(item.tags) ? item.tags : [];

  return (
    <motion.div
      onPointerDown={gestureHandlers.onPointerDown}
      style={{
        x,
        y,
        rotate: rotation,
        touchAction: "none",
        ...style,
      }}
      initial={false}
      animate={
        isExiting && exitDirection
          ? EXIT_ANIMATIONS[exitDirection]
          : { opacity: 1, scale: 1 }
      }
      transition={SPRING_CONFIG}
      className={cn(
        "absolute inset-x-4 bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden",
        "touch-none select-none",
        isActive ? "cursor-grab active:cursor-grabbing" : "pointer-events-none"
      )}
    >
      {/* Swipe feedback overlay */}
      <SwipeFeedback direction={feedbackDirection} opacity={feedbackOpacity} />

      {/* Card content */}
      <div className="relative z-10 p-4">
        {/* Header: Source & Timestamp */}
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-3">
          <SourceIcon className="h-4 w-4" />
          <span className="capitalize">{item.type}</span>
          <span className="mx-1">-</span>
          <span>{timeAgo} ago</span>
        </div>

        {/* Content preview */}
        <div className="mb-4">
          <p className="text-gray-800 leading-relaxed line-clamp-3">
            {contentPreview}
          </p>
        </div>

        {/* AI Classification */}
        {item.aiClassification && (
          <div className="flex items-center justify-between mb-3 py-2 px-3 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-2">
              <CategoryBadge
                category={item.aiClassification.category}
              />
            </div>
            <ConfidenceBadge confidence={item.aiClassification.confidence} />
          </div>
        )}

        {/* AI Reasoning */}
        {item.aiClassification?.reasoning && (
          <p className="text-sm text-gray-500 italic mb-3">
            &ldquo;{item.aiClassification.reasoning}&rdquo;
          </p>
        )}

        {/* Tags */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-2 overflow-x-auto pb-1">
            {tags.slice(0, 5).map((tag, index) => (
              <span
                key={index}
                className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-md"
              >
                {tag}
              </span>
            ))}
            {tags.length > 5 && (
              <span className="px-2 py-1 text-gray-400 text-xs">
                +{tags.length - 5} more
              </span>
            )}
          </div>
        )}
      </div>

      {/* Direction indicator border */}
      {feedbackDirection && feedbackOpacity > 0.3 && (
        <div
          className={cn(
            "absolute inset-0 rounded-xl border-4 pointer-events-none transition-opacity",
            SWIPE_FEEDBACK[feedbackDirection].border
          )}
          style={{ opacity: feedbackOpacity }}
        />
      )}
    </motion.div>
  );
}
