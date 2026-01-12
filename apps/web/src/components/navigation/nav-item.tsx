"use client";

import Link from "next/link";
import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface NavItemProps {
  href: string;
  label: string;
  icon?: LucideIcon;
  emoji?: string;
  color?: string | null;
  badge?: number;
  active?: boolean;
  level?: number; // For nested indentation (0 = no indent, 1 = one level, etc.)
  className?: string;
}

export function NavItem({
  href,
  label,
  icon: Icon,
  emoji,
  color,
  badge,
  active = false,
  level = 0,
  className,
}: NavItemProps) {
  return (
    <Link
      href={href}
      className={cn(
        "flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors",
        "hover:bg-accent hover:text-accent-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        active && "bg-primary/10 text-primary font-semibold",
        !active && "text-muted-foreground",
        className
      )}
      style={{ paddingLeft: `${12 + level * 24}px` }}
      aria-current={active ? "page" : undefined}
    >
      {/* Icon */}
      {Icon && <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />}

      {/* Emoji */}
      {emoji && !Icon && (
        <span className="text-base shrink-0" aria-hidden="true">
          {emoji}
        </span>
      )}

      {/* Color dot (for projects without icon/emoji) */}
      {color && !Icon && !emoji && (
        <span
          className="h-3 w-3 rounded-full shrink-0"
          style={{ backgroundColor: color }}
          aria-hidden="true"
        />
      )}

      {/* Label */}
      <span className="flex-1 truncate">{label}</span>

      {/* Badge */}
      {badge !== undefined && badge > 0 && (
        <Badge
          variant="secondary"
          className="ml-auto h-5 px-2 text-xs"
          aria-label={`${badge} items`}
        >
          {badge > 99 ? "99+" : badge}
        </Badge>
      )}
    </Link>
  );
}
