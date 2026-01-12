"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Inbox,
  Calendar,
  Search,
  FolderKanban,
  CircleDot,
  Library,
  Archive,
  Settings,
  ChevronDown,
  ChevronRight,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { CreateProjectModal } from "./create-project-modal";
import { CreateAreaModal } from "./create-area-modal";

interface NavItemProps {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  badge?: number;
  color?: string | null;
  isActive?: boolean;
}

function NavItem({ href, icon, children, badge, color, isActive }: NavItemProps) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
        isActive
          ? "bg-primary/10 text-primary font-medium"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      <span
        className="flex-shrink-0"
        style={color ? { color } : undefined}
      >
        {icon}
      </span>
      <span className="flex-1 truncate">{children}</span>
      {badge !== undefined && badge > 0 && (
        <span className="text-xs bg-muted px-1.5 py-0.5 rounded">{badge}</span>
      )}
    </Link>
  );
}

interface NavSectionProps {
  title?: string;
  expanded?: boolean;
  onToggle?: () => void;
  onAdd?: () => void;
  children: React.ReactNode;
}

function NavSection({ title, expanded = true, onToggle, onAdd, children }: NavSectionProps) {
  return (
    <div className="space-y-1">
      {title && (
        <div className="flex items-center justify-between px-3 py-2">
          <button
            onClick={onToggle}
            className="flex items-center gap-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground"
          >
            {onToggle && (
              expanded ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )
            )}
            {title}
          </button>
          {onAdd && (
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5"
              onClick={(e) => {
                e.stopPropagation();
                onAdd();
              }}
            >
              <Plus className="h-3 w-3" />
            </Button>
          )}
        </div>
      )}
      {expanded && <div className="space-y-0.5">{children}</div>}
    </div>
  );
}

export function PARANav() {
  const pathname = usePathname();
  const { data: projects, isLoading: projectsLoading } = trpc.para.listProjects.useQuery({
    status: "active",
  });
  const { data: areas, isLoading: areasLoading } = trpc.para.listAreas.useQuery();

  const [expandedSections, setExpandedSections] = useState({
    projects: true,
    areas: true,
    resources: false,
  });
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [showCreateArea, setShowCreateArea] = useState(false);

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  return (
    <nav className="flex flex-col h-full py-4">
      {/* Quick Access */}
      <NavSection>
        <NavItem
          href="/inbox"
          icon={<Inbox className="h-4 w-4" />}
          isActive={pathname === "/inbox"}
        >
          Inbox
        </NavItem>
        <NavItem
          href="/today"
          icon={<Calendar className="h-4 w-4" />}
          isActive={pathname === "/today"}
        >
          Today
        </NavItem>
        <NavItem
          href="/search"
          icon={<Search className="h-4 w-4" />}
          isActive={pathname === "/search"}
        >
          Search
        </NavItem>
      </NavSection>

      <div className="my-4 border-t" />

      {/* Projects */}
      <NavSection
        title="Projects"
        expanded={expandedSections.projects}
        onToggle={() => toggleSection("projects")}
        onAdd={() => setShowCreateProject(true)}
      >
        {projectsLoading ? (
          <div className="space-y-2 px-3">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : projects && projects.length > 0 ? (
          projects.map((project) => (
            <NavItem
              key={project.id}
              href={`/projects/${project.id}`}
              icon={<FolderKanban className="h-4 w-4" />}
              color={project.color}
              badge={project._count.actions}
              isActive={pathname === `/projects/${project.id}`}
            >
              {project.name}
            </NavItem>
          ))
        ) : (
          <p className="text-sm text-muted-foreground px-3 py-2">No active projects</p>
        )}
      </NavSection>

      {/* Areas */}
      <NavSection
        title="Areas"
        expanded={expandedSections.areas}
        onToggle={() => toggleSection("areas")}
        onAdd={() => setShowCreateArea(true)}
      >
        {areasLoading ? (
          <div className="space-y-2 px-3">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : areas && areas.length > 0 ? (
          areas.map((area) => (
            <NavItem
              key={area.id}
              href={`/areas/${area.id}`}
              icon={area.icon ? <span>{area.icon}</span> : <CircleDot className="h-4 w-4" />}
              color={area.color}
              isActive={pathname === `/areas/${area.id}`}
            >
              {area.name}
            </NavItem>
          ))
        ) : (
          <p className="text-sm text-muted-foreground px-3 py-2">No areas yet</p>
        )}
      </NavSection>

      {/* Resources */}
      <NavSection
        title="Resources"
        expanded={expandedSections.resources}
        onToggle={() => toggleSection("resources")}
      >
        <NavItem
          href="/resources"
          icon={<Library className="h-4 w-4" />}
          isActive={pathname === "/resources"}
        >
          View all
        </NavItem>
      </NavSection>

      <div className="flex-1" />

      <div className="border-t pt-4">
        <NavSection>
          <NavItem
            href="/archive"
            icon={<Archive className="h-4 w-4" />}
            isActive={pathname === "/archive"}
          >
            Archive
          </NavItem>
          <NavItem
            href="/settings"
            icon={<Settings className="h-4 w-4" />}
            isActive={pathname === "/settings"}
          >
            Settings
          </NavItem>
        </NavSection>
      </div>

      {/* Modals */}
      <CreateProjectModal
        open={showCreateProject}
        onClose={() => setShowCreateProject(false)}
      />
      <CreateAreaModal
        open={showCreateArea}
        onClose={() => setShowCreateArea(false)}
      />
    </nav>
  );
}
