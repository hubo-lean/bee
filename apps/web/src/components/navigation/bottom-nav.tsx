"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Home, Inbox, PlayCircle, Search } from "lucide-react";
import { InboxBadge } from "./inbox-badge";

interface BottomNavProps {
  className?: string;
}

const navItems = [
  { href: "/dashboard", label: "Home", icon: Home, showBadge: false },
  { href: "/inbox", label: "Inbox", icon: Inbox, showBadge: true },
  { href: "/review", label: "Review", icon: PlayCircle, showBadge: false },
  { href: "/search", label: "Search", icon: Search, showBadge: false },
];

export function BottomNav({ className }: BottomNavProps) {
  const pathname = usePathname();

  return (
    <nav
      className={cn(
        "fixed bottom-0 left-0 right-0 z-50 border-t bg-white pb-safe",
        className
      )}
      aria-label="Main navigation"
    >
      <div className="flex h-16 items-center justify-around">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative flex min-h-[44px] min-w-[64px] flex-col items-center justify-center gap-1 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
                isActive ? "text-blue-600" : "text-gray-500"
              )}
              aria-current={isActive ? "page" : undefined}
              aria-label={item.label}
            >
              <div className="relative">
                <item.icon className="h-6 w-6" aria-hidden="true" />
                {item.showBadge && (
                  <InboxBadge className="absolute -right-2 -top-1 h-4 min-w-4 text-[10px]" />
                )}
              </div>
              <span className="text-xs font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
