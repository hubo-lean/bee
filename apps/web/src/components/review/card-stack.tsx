"use client";

import { SwipeCard, type InboxItemData } from "./swipe-card";
import { type SwipeDirection } from "@/lib/constants/swipe";
import type { InboxItem } from "@packages/db";

interface CardStackProps {
  items: InboxItem[];
  currentIndex: number;
  onSwipe: (direction: SwipeDirection, itemId: string) => void;
}

// Transform Prisma InboxItem to SwipeCard's expected format
function transformItem(item: InboxItem): InboxItemData {
  const aiClassification = item.aiClassification as Record<string, unknown> | null;
  const tags = Array.isArray(item.tags)
    ? (item.tags as Array<{ value?: string }>).map((t) => (typeof t === "string" ? t : t.value || "")).filter(Boolean)
    : [];

  return {
    id: item.id,
    type: item.type,
    content: item.content,
    source: item.source,
    aiClassification: aiClassification
      ? {
          category: aiClassification.category as InboxItemData["aiClassification"] extends null ? never : NonNullable<InboxItemData["aiClassification"]>["category"],
          confidence: aiClassification.confidence as number,
          reasoning: aiClassification.reasoning as string | undefined,
        }
      : null,
    tags,
    createdAt: item.createdAt,
  };
}

export function CardStack({ items, currentIndex, onSwipe }: CardStackProps) {
  // Show current card + 2 behind for stack effect
  const visibleCards = items.slice(currentIndex, currentIndex + 3);

  if (visibleCards.length === 0) {
    return null;
  }

  return (
    <div className="relative h-full w-full">
      {visibleCards.map((item, stackIndex) => (
        <div
          key={item.id}
          className="absolute inset-0"
          style={{
            zIndex: 3 - stackIndex,
          }}
        >
          <SwipeCard
            item={transformItem(item)}
            isActive={stackIndex === 0}
            stackIndex={stackIndex}
            onSwipe={(dir) => onSwipe(dir, item.id)}
          />
        </div>
      ))}
    </div>
  );
}
