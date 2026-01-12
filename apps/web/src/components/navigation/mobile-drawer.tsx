"use client";

import { useEffect, useRef, useCallback } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { X, Plus, Menu } from "lucide-react";
import {
  Inbox,
  Calendar,
  Target,
  PlayCircle,
  Search,
  CalendarDays,
  Settings,
  FolderKanban,
  CircleDot,
  Library,
  Archive,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { NavSection } from "./nav-section";
import { NavItem } from "./nav-item";
import { useCapture } from "@/components/capture/capture-provider";
import { trpc } from "@/lib/trpc";
import { SignOutButton } from "@/components/auth/sign-out-button";

interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
}

export function MobileDrawer({ isOpen, onClose, user }: MobileDrawerProps) {
  const pathname = usePathname();
  const drawerRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousActiveElement = useRef<Element | null>(null);

  const { openCapture } = useCapture();

  // Data queries
  const { data: inboxCount } = trpc.inbox.count.useQuery(undefined, {
    refetchInterval: 30000,
  });

  const { data: projects, isLoading: projectsLoading } =
    trpc.para.listProjects.useQuery({
      status: "active",
    });

  const { data: areas, isLoading: areasLoading } =
    trpc.para.listAreas.useQuery();

  // Close drawer when route changes
  useEffect(() => {
    if (isOpen) {
      onClose();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Handle open/close effects
  useEffect(() => {
    if (isOpen) {
      // Store current active element
      previousActiveElement.current = document.activeElement;

      // Prevent body scroll
      document.body.style.overflow = "hidden";

      // Focus close button when drawer opens
      setTimeout(() => {
        closeButtonRef.current?.focus();
      }, 100);

      return () => {
        document.body.style.overflow = "";
      };
    } else {
      // Restore focus when closed
      if (previousActiveElement.current instanceof HTMLElement) {
        previousActiveElement.current.focus();
      }
    }
  }, [isOpen]);

  // Handle Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  // Focus trap
  useEffect(() => {
    if (!isOpen || !drawerRef.current) return;

    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || !drawerRef.current) return;

      const focusableElements = drawerRef.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );

      if (focusableElements.length === 0) return;

      const firstElement = focusableElements[0] as HTMLElement;
      const lastElement = focusableElements[
        focusableElements.length - 1
      ] as HTMLElement;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };

    document.addEventListener("keydown", handleTab);
    return () => document.removeEventListener("keydown", handleTab);
  }, [isOpen]);

  const handleCaptureClick = useCallback(() => {
    onClose();
    setTimeout(() => {
      openCapture();
    }, 200);
  }, [onClose, openCapture]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 lg:hidden" aria-hidden={!isOpen}>
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 animate-in fade-in duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        className={cn(
          "absolute top-0 left-0 bottom-0 w-[85vw] max-w-[320px]",
          "flex flex-col bg-background shadow-xl",
          "animate-in slide-in-from-left duration-300"
        )}
      >
        {/* Header with Logo and Close Button */}
        <div className="flex h-16 items-center justify-between border-b px-4">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 font-bold text-xl"
            onClick={onClose}
            aria-label="Bee home"
          >
            <span className="text-2xl">🐝</span>
            <span>Bee</span>
          </Link>
          <Button
            ref={closeButtonRef}
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Close navigation menu"
          >
            <X className="h-6 w-6" />
          </Button>
        </div>

        {/* Quick Capture Button */}
        <div className="p-4">
          <Button
            onClick={handleCaptureClick}
            className="w-full justify-start gap-3"
            aria-label="Quick Capture"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Quick Capture
          </Button>
        </div>

        {/* Navigation Sections */}
        <nav className="flex-1 overflow-y-auto px-2">
          {/* Quick Access Section */}
          <NavSection title="Quick Access" collapsible={false}>
            <NavItem
              href="/inbox"
              icon={Inbox}
              label="Inbox"
              badge={inboxCount?.count ?? 0}
              active={pathname === "/inbox"}
            />
            <NavItem
              href="/today"
              icon={Calendar}
              label="Today"
              active={pathname === "/today"}
            />
            <NavItem
              href="/objectives"
              icon={Target}
              label="Objectives"
              active={
                pathname === "/objectives" ||
                pathname.startsWith("/objectives/")
              }
            />
            <NavItem
              href="/review"
              icon={PlayCircle}
              label="Review"
              active={
                pathname === "/review" || pathname.startsWith("/review/")
              }
            />
            <NavItem
              href="/search"
              icon={Search}
              label="Search"
              active={pathname === "/search"}
            />
            <NavItem
              href="/calendar"
              icon={CalendarDays}
              label="Calendar"
              active={pathname === "/calendar"}
            />
          </NavSection>

          {/* Projects Section */}
          <NavSection title="Projects" collapsible={false}>
            {projectsLoading ? (
              <div className="space-y-2 px-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : projects && projects.length > 0 ? (
              projects.slice(0, 5).map((project) => (
                <NavItem
                  key={project.id}
                  href={`/projects/${project.id}`}
                  icon={FolderKanban}
                  color={project.color}
                  label={project.name}
                  badge={project._count.actions}
                  active={pathname === `/projects/${project.id}`}
                />
              ))
            ) : (
              <p className="px-3 py-2 text-sm text-muted-foreground">
                No active projects
              </p>
            )}
            {projects && projects.length > 5 && (
              <NavItem
                href="/projects"
                label={`View all ${projects.length} projects`}
                active={pathname === "/projects"}
              />
            )}
          </NavSection>

          {/* Areas Section */}
          <NavSection title="Areas" collapsible={false}>
            {areasLoading ? (
              <div className="space-y-2 px-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : areas && areas.length > 0 ? (
              areas.slice(0, 5).map((area) => (
                <NavItem
                  key={area.id}
                  href={`/areas/${area.id}`}
                  emoji={area.icon ?? undefined}
                  icon={area.icon ? undefined : CircleDot}
                  color={area.color}
                  label={area.name}
                  active={pathname === `/areas/${area.id}`}
                />
              ))
            ) : (
              <p className="px-3 py-2 text-sm text-muted-foreground">
                No areas yet
              </p>
            )}
            {areas && areas.length > 5 && (
              <NavItem
                href="/areas"
                label={`View all ${areas.length} areas`}
                active={pathname === "/areas"}
              />
            )}
          </NavSection>

          {/* Resources & Archive */}
          <NavSection title="More" collapsible={false}>
            <NavItem
              href="/resources"
              icon={Library}
              label="Resources"
              active={
                pathname === "/resources" || pathname.startsWith("/resources/")
              }
            />
            <NavItem
              href="/archive"
              icon={Archive}
              label="Archive"
              active={pathname === "/archive"}
            />
          </NavSection>
        </nav>

        {/* Settings */}
        <div className="border-t px-2 py-2">
          <NavItem
            href="/settings"
            icon={Settings}
            label="Settings"
            active={
              pathname === "/settings" || pathname.startsWith("/settings/")
            }
          />
        </div>

        {/* User Section */}
        <div className="border-t p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
              {user.image ? (
                <Image
                  src={user.image}
                  alt={user.name || "User"}
                  width={40}
                  height={40}
                  className="h-10 w-10 rounded-full"
                />
              ) : (
                <span className="text-sm font-medium text-muted-foreground">
                  {user.name?.charAt(0).toUpperCase() || "U"}
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {user.name || "User"}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {user.email || ""}
              </p>
            </div>
          </div>
          <SignOutButton className="mt-3 w-full" />
        </div>
      </div>
    </div>
  );
}
