"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Home, Inbox, PlayCircle, Search, Menu } from "lucide-react";
import { InboxBadge } from "./inbox-badge";

interface BottomNavProps {
  onMenuClick?: () => void;
  className?: string;
}

const navItems = [
  { href: "/dashboard", label: "Home", icon: Home, showBadge: false },
  { href: "/inbox", label: "Inbox", icon: Inbox, showBadge: true },
  { href: "/review", label: "Review", icon: PlayCircle, showBadge: false },
  { href: "/search", label: "Search", icon: Search, showBadge: false },
];

export function BottomNav({ onMenuClick, className }: BottomNavProps) {
  const pathname = usePathname();

  return (
    <nav
      className={cn(
        "fixed bottom-0 left-0 right-0 z-40 border-t bg-background pb-safe",
        className
      )}
      aria-label="Mobile navigation"
      role="navigation"
    >
      <div className="flex h-14 items-center justify-around">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative flex min-h-[44px] min-w-[48px] flex-col items-center justify-center gap-0.5 px-2 py-1",
                "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                isActive ? "text-primary" : "text-muted-foreground"
              )}
              aria-current={isActive ? "page" : undefined}
            >
              <div className="relative">
                <item.icon className="h-6 w-6" aria-hidden="true" />
                {item.showBadge && (
                  <InboxBadge className="absolute -right-2 -top-1 h-4 min-w-4 text-[10px]" />
                )}
              </div>
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}

        {/* Menu Button */}
        <button
          onClick={onMenuClick}
          className={cn(
            "relative flex min-h-[44px] min-w-[48px] flex-col items-center justify-center gap-0.5 px-2 py-1",
            "text-muted-foreground transition-colors hover:text-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          )}
          aria-label="Open navigation menu"
          aria-haspopup="dialog"
          type="button"
        >
          <Menu className="h-6 w-6" aria-hidden="true" />
          <span className="text-[10px] font-medium">Menu</span>
        </button>
      </div>
    </nav>
  );
}
