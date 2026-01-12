"use client";

import { ChevronDown, ChevronRight, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface NavSectionProps {
  title: string;
  children: React.ReactNode;
  collapsible?: boolean;
  expanded?: boolean;
  onToggle?: () => void;
  onAdd?: () => void;
  className?: string;
}

export function NavSection({
  title,
  children,
  collapsible = false,
  expanded = true,
  onToggle,
  onAdd,
  className,
}: NavSectionProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (collapsible && onToggle && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      onToggle();
    }
  };

  return (
    <div className={cn("py-2", className)}>
      {/* Section Header */}
      <div className="flex items-center justify-between px-3 py-2">
        <button
          onClick={collapsible ? onToggle : undefined}
          onKeyDown={handleKeyDown}
          className={cn(
            "flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground",
            collapsible && "hover:text-foreground cursor-pointer",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:rounded"
          )}
          aria-expanded={collapsible ? expanded : undefined}
          tabIndex={collapsible ? 0 : -1}
          type="button"
        >
          {collapsible && (
            <span aria-hidden="true">
              {expanded ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
            </span>
          )}
          {title}
        </button>

        {onAdd && (
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 text-muted-foreground hover:text-foreground"
            onClick={(e) => {
              e.stopPropagation();
              onAdd();
            }}
            aria-label={`Add new ${title.toLowerCase().replace(/s$/, "")}`}
          >
            <Plus className="h-3 w-3" />
          </Button>
        )}
      </div>

      {/* Section Content with animation */}
      <div
        className={cn(
          "space-y-1 overflow-hidden transition-all duration-200 ease-out",
          collapsible && !expanded && "h-0"
        )}
        aria-hidden={collapsible && !expanded}
      >
        {children}
      </div>
    </div>
  );
}
