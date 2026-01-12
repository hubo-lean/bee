"use client";

import { use } from "react";
import Link from "next/link";
import { format } from "date-fns";
import {
  MoreHorizontal,
  ArrowLeft,
  Calendar,
  Target,
  CheckCircle,
  Circle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
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

export default function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const utils = trpc.useUtils();
  const { data: project, isLoading } = trpc.para.getProject.useQuery({ id });

  const updateProject = trpc.para.updateProject.useMutation({
    onSuccess: () => {
      utils.para.getProject.invalidate({ id });
      utils.para.listProjects.invalidate();
    },
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
        <div className="flex gap-4">
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-10 w-32" />
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Project not found</p>
        <Link href="/inbox" className="text-primary hover:underline">
          Go back
        </Link>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Link
              href="/inbox"
              className="text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <h1
              className="text-2xl font-bold"
              style={project.color ? { color: project.color } : undefined}
            >
              {project.name}
            </h1>
          </div>
          {project.description && (
            <p className="text-muted-foreground mb-3">{project.description}</p>
          )}
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            {project.area && (
              <span className="flex items-center gap-1">
                {project.area.icon && <span>{project.area.icon}</span>}
                {project.area.name}
              </span>
            )}
            {project.dueDate && (
              <span className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                Due {format(new Date(project.dueDate), "MMM d, yyyy")}
              </span>
            )}
            {project.objective && (
              <span className="flex items-center gap-1">
                <Target className="h-4 w-4" />
                {project.objective.title}
              </span>
            )}
            <ProjectStatusBadge status={project.status} />
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreHorizontal className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>Edit</DropdownMenuItem>
            <DropdownMenuItem
              onClick={() =>
                updateProject.mutate({ id, status: "on_hold" })
              }
              disabled={project.status === "on_hold"}
            >
              Put On Hold
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() =>
                updateProject.mutate({ id, status: "completed" })
              }
              disabled={project.status === "completed"}
            >
              Mark Complete
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive"
              onClick={() =>
                updateProject.mutate({ id, status: "archived" })
              }
            >
              Archive
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="actions">
        <TabsList>
          <TabsTrigger value="actions">
            Actions ({project._count?.actions || 0})
          </TabsTrigger>
          <TabsTrigger value="notes">
            Notes ({project._count?.notes || 0})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="actions" className="mt-6">
          <Card>
            <CardContent className="py-6">
              <div className="text-center text-muted-foreground">
                <Circle className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No actions yet</p>
                <p className="text-sm">
                  Actions linked to this project will appear here
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notes" className="mt-6">
          <Card>
            <CardContent className="py-6">
              <div className="text-center text-muted-foreground">
                <CheckCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No notes yet</p>
                <p className="text-sm">
                  Notes linked to this project will appear here
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
