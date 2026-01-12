"use client";

import { cn } from "@/lib/utils";
import { CATEGORY_CONFIG, type Category } from "@/lib/constants/swipe";
import {
  CheckSquare,
  FileText,
  Bookmark,
  Calendar,
  HelpCircle,
} from "lucide-react";

interface CategoryBadgeProps {
  category: Category;
  className?: string;
  showIcon?: boolean;
}

const CATEGORY_ICONS = {
  action: CheckSquare,
  note: FileText,
  reference: Bookmark,
  meeting: Calendar,
  unknown: HelpCircle,
} as const;

export function CategoryBadge({
  category,
  className,
  showIcon = true,
}: CategoryBadgeProps) {
  const config = CATEGORY_CONFIG[category] || CATEGORY_CONFIG.unknown;
  const Icon = CATEGORY_ICONS[category] || CATEGORY_ICONS.unknown;

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm font-medium",
        config.bg,
        config.color,
        className
      )}
    >
      {showIcon && <Icon className="h-3.5 w-3.5" />}
      <span className="uppercase text-xs tracking-wide">{config.label}</span>
    </div>
  );
}
