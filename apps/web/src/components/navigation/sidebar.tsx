"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { SignOutButton } from "@/components/auth/sign-out-button";
import {
  Home,
  Inbox,
  PlayCircle,
  Search,
  Settings,
  Calendar,
} from "lucide-react";

interface SidebarProps {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
  className?: string;
}

const navItems = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/inbox", label: "Inbox", icon: Inbox },
  { href: "/review", label: "Review", icon: PlayCircle },
  { href: "/search", label: "Search", icon: Search },
  { href: "/calendar", label: "Calendar", icon: Calendar },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar({ user, className }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 flex-col border-r bg-white",
        className
      )}
      aria-label="Main navigation"
    >
      {/* Logo */}
      <div className="flex h-16 items-center border-b px-6">
        <Link
          href="/dashboard"
          className="flex items-center gap-2"
          aria-label="Bee home"
        >
          <span className="text-2xl">🐝</span>
          <span className="text-xl font-bold">Bee</span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4" aria-label="Sidebar">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
                isActive
                  ? "bg-gray-100 text-gray-900"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              )}
              aria-current={isActive ? "page" : undefined}
            >
              <item.icon className="h-5 w-5" aria-hidden="true" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User Profile */}
      <div className="border-t p-4">
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-200">
            {user.image ? (
              <Image
                src={user.image}
                alt={user.name || "User"}
                width={40}
                height={40}
                className="h-10 w-10 rounded-full"
              />
            ) : (
              <span className="text-sm font-medium text-gray-600">
                {user.name?.charAt(0).toUpperCase() || "U"}
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-gray-900">
              {user.name || "User"}
            </p>
            <p className="truncate text-xs text-gray-500">
              {user.email || ""}
            </p>
          </div>
        </div>
        <SignOutButton className="mt-3 w-full" />
      </div>
    </aside>
  );
}
