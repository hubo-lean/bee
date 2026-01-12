"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Inbox,
  Calendar,
  Target,
  PlayCircle,
  Search,
  CalendarDays,
  Settings,
  Plus,
  FolderKanban,
  CircleDot,
  Library,
  Archive,
} from "lucide-react";
import { NavSection } from "./nav-section";
import { NavItem } from "./nav-item";
import { useCapture } from "@/components/capture/capture-provider";
import { trpc } from "@/lib/trpc";
import { CreateProjectModal } from "@/components/para/create-project-modal";
import { CreateAreaModal } from "@/components/para/create-area-modal";
import { SignOutButton } from "@/components/auth/sign-out-button";

interface UnifiedSidebarProps {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
  className?: string;
}

interface SidebarState {
  projects: boolean;
  areas: boolean;
  resources: boolean;
  archive: boolean;
}

const SIDEBAR_STATE_KEY = "bee-sidebar-state";

const defaultSidebarState: SidebarState = {
  projects: true,
  areas: true,
  resources: false,
  archive: false,
};

export function UnifiedSidebar({ user, className }: UnifiedSidebarProps) {
  const pathname = usePathname();
  const { openCapture } = useCapture();

  // Sidebar section collapse state
  const [expandedSections, setExpandedSections] =
    useState<SidebarState>(defaultSidebarState);
  const [isHydrated, setIsHydrated] = useState(false);

  // Modal states
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [showCreateArea, setShowCreateArea] = useState(false);

  // Data queries
  const { data: inboxCount } = trpc.inbox.count.useQuery(undefined, {
    refetchInterval: 30000,
  });

  const { data: todayCount } = trpc.actions.getTodayCount.useQuery(undefined, {
    refetchInterval: 30000,
  });

  const { data: projects, isLoading: projectsLoading } =
    trpc.para.listProjects.useQuery({
      status: "active",
    });

  const { data: areas, isLoading: areasLoading } =
    trpc.para.listAreas.useQuery();

  // Load persisted state on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(SIDEBAR_STATE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as SidebarState;
        setExpandedSections(parsed);
      }
    } catch {
      // Ignore invalid JSON
    }
    setIsHydrated(true);
  }, []);

  // Persist state changes
  useEffect(() => {
    if (isHydrated) {
      localStorage.setItem(SIDEBAR_STATE_KEY, JSON.stringify(expandedSections));
    }
  }, [expandedSections, isHydrated]);

  const toggleSection = (section: keyof SidebarState) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  return (
    <>
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex h-full w-[264px] flex-col border-r bg-background",
          className
        )}
        role="navigation"
        aria-label="Main navigation"
      >
        {/* Logo Section */}
        <div className="flex h-16 items-center border-b px-4">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 font-bold text-xl"
            aria-label="Bee home"
          >
            <span className="text-2xl">🐝</span>
            <span>Bee</span>
          </Link>
        </div>

        {/* Quick Capture Button */}
        <div className="p-4">
          <Button
            onClick={openCapture}
            className="w-full justify-start gap-3"
            aria-label="Quick Capture (Ctrl+K)"
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
              badge={todayCount ?? 0}
              active={pathname === "/today"}
            />
            <NavItem
              href="/objectives"
              icon={Target}
              label="Objectives"
              active={pathname === "/objectives" || pathname.startsWith("/objectives/")}
            />
            <NavItem
              href="/review"
              icon={PlayCircle}
              label="Review"
              active={pathname === "/review" || pathname.startsWith("/review/")}
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

          {/* PARA Section - Projects */}
          <NavSection
            title="Projects"
            collapsible
            expanded={expandedSections.projects}
            onToggle={() => toggleSection("projects")}
            onAdd={() => setShowCreateProject(true)}
          >
            {projectsLoading ? (
              <div className="space-y-2 px-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : projects && projects.length > 0 ? (
              projects.map((project) => (
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
          </NavSection>

          {/* PARA Section - Areas */}
          <NavSection
            title="Areas"
            collapsible
            expanded={expandedSections.areas}
            onToggle={() => toggleSection("areas")}
            onAdd={() => setShowCreateArea(true)}
          >
            {areasLoading ? (
              <div className="space-y-2 px-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : areas && areas.length > 0 ? (
              areas.map((area) => (
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
          </NavSection>

          {/* PARA Section - Resources */}
          <NavSection
            title="Resources"
            collapsible
            expanded={expandedSections.resources}
            onToggle={() => toggleSection("resources")}
          >
            <NavItem
              href="/resources"
              icon={Library}
              label="View all"
              active={pathname === "/resources" || pathname.startsWith("/resources/")}
            />
          </NavSection>

          {/* PARA Section - Archive */}
          <NavSection
            title="Archive"
            collapsible
            expanded={expandedSections.archive}
            onToggle={() => toggleSection("archive")}
          >
            <NavItem
              href="/archive"
              icon={Archive}
              label="Browse archive"
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
            active={pathname === "/settings" || pathname.startsWith("/settings/")}
          />
        </div>

        {/* User Section */}
        <div className="border-t p-4">
          <div className="flex items-center gap-3">
            {/* Avatar */}
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
      </aside>

      {/* Modals */}
      <CreateProjectModal
        open={showCreateProject}
        onClose={() => setShowCreateProject(false)}
      />
      <CreateAreaModal
        open={showCreateArea}
        onClose={() => setShowCreateArea(false)}
      />
    </>
  );
}
