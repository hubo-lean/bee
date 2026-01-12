"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, FolderKanban, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";

function ProjectStatusBadge({ status }: { status: string }) {
  const variants: Record<string, { variant: "default" | "secondary" | "outline"; label: string }> = {
    active: { variant: "default", label: "Active" },
    on_hold: { variant: "secondary", label: "On Hold" },
    completed: { variant: "outline", label: "Completed" },
    archived: { variant: "outline", label: "Archived" },
  };

  const config = variants[status] || variants.active;

  return <Badge variant={config.variant}>{config.label}</Badge>;
}

export default function ProjectsPage() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectDescription, setNewProjectDescription] = useState("");

  const utils = trpc.useUtils();
  const { data: projects, isLoading, isError, refetch } = trpc.para.listProjects.useQuery();

  const createProject = trpc.para.createProject.useMutation({
    onSuccess: () => {
      utils.para.listProjects.invalidate();
      setIsCreateOpen(false);
      setNewProjectName("");
      setNewProjectDescription("");
    },
  });

  const updateProject = trpc.para.updateProject.useMutation({
    onSuccess: () => {
      utils.para.listProjects.invalidate();
    },
  });

  const handleCreateProject = () => {
    if (!newProjectName.trim()) return;
    createProject.mutate({
      name: newProjectName.trim(),
      description: newProjectDescription.trim() || undefined,
    });
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-muted-foreground">Failed to load projects</p>
        <Button variant="link" onClick={() => refetch()} className="mt-2">
          Try again
        </Button>
      </div>
    );
  }

  // Empty state
  if (!projects || projects.length === 0) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Projects</h1>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                New Project
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Project</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    placeholder="Project name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description (optional)</Label>
                  <Textarea
                    id="description"
                    value={newProjectDescription}
                    onChange={(e) => setNewProjectDescription(e.target.value)}
                    placeholder="Brief description"
                  />
                </div>
                <Button
                  onClick={handleCreateProject}
                  disabled={!newProjectName.trim() || createProject.isPending}
                  className="w-full"
                >
                  {createProject.isPending ? "Creating..." : "Create Project"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardContent className="py-16 text-center">
            <FolderKanban className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
            <h2 className="text-lg font-semibold mb-2">No projects yet</h2>
            <p className="text-muted-foreground mb-4">
              Create your first project to start organizing your work.
            </p>
            <Button onClick={() => setIsCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Project
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Projects list
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Projects</h1>
          <p className="text-sm text-muted-foreground">{projects.length} projects</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Project
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Project</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="Project name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description (optional)</Label>
                <Textarea
                  id="description"
                  value={newProjectDescription}
                  onChange={(e) => setNewProjectDescription(e.target.value)}
                  placeholder="Brief description"
                />
              </div>
              <Button
                onClick={handleCreateProject}
                disabled={!newProjectName.trim() || createProject.isPending}
                className="w-full"
              >
                {createProject.isPending ? "Creating..." : "Create Project"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Projects Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {projects.map((project) => (
          <Card key={project.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <Link
                  href={`/projects/${project.id}`}
                  className="flex-1 group"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <FolderKanban
                      className="h-5 w-5"
                      style={project.color ? { color: project.color } : undefined}
                    />
                    <h3
                      className="font-semibold group-hover:text-primary transition-colors"
                      style={project.color ? { color: project.color } : undefined}
                    >
                      {project.name}
                    </h3>
                  </div>
                  {project.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                      {project.description}
                    </p>
                  )}
                  <div className="flex items-center gap-2">
                    <ProjectStatusBadge status={project.status} />
                    {project.area && (
                      <span className="text-xs text-muted-foreground">
                        {project.area.icon} {project.area.name}
                      </span>
                    )}
                  </div>
                </Link>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild>
                      <Link href={`/projects/${project.id}`}>View Details</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => updateProject.mutate({ id: project.id, status: "on_hold" })}
                      disabled={project.status === "on_hold"}
                    >
                      Put On Hold
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => updateProject.mutate({ id: project.id, status: "completed" })}
                      disabled={project.status === "completed"}
                    >
                      Mark Complete
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => updateProject.mutate({ id: project.id, status: "archived" })}
                    >
                      Archive
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
