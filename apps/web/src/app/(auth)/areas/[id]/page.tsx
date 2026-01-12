"use client";

import { use } from "react";
import Link from "next/link";
import { MoreHorizontal, ArrowLeft, FolderKanban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";

export default function AreaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: area, isLoading } = trpc.para.getArea.useQuery({ id });

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!area) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Area not found</p>
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
            <h1 className="text-2xl font-bold flex items-center gap-2">
              {area.icon && <span className="text-3xl">{area.icon}</span>}
              <span style={area.color ? { color: area.color } : undefined}>
                {area.name}
              </span>
            </h1>
          </div>
          {area.description && (
            <p className="text-muted-foreground">{area.description}</p>
          )}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreHorizontal className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>Edit</DropdownMenuItem>
            <DropdownMenuItem className="text-destructive">Delete</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="py-4 text-center">
            <p className="text-2xl font-bold">{area._count?.actions || 0}</p>
            <p className="text-sm text-muted-foreground">Actions</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-center">
            <p className="text-2xl font-bold">{area._count?.notes || 0}</p>
            <p className="text-sm text-muted-foreground">Notes</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-center">
            <p className="text-2xl font-bold">{area._count?.resources || 0}</p>
            <p className="text-sm text-muted-foreground">Resources</p>
          </CardContent>
        </Card>
      </div>

      {/* Projects in this area */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FolderKanban className="h-5 w-5" />
            Projects in this Area
          </CardTitle>
        </CardHeader>
        <CardContent>
          {area.projects && area.projects.length > 0 ? (
            <div className="space-y-2">
              {area.projects.map((project) => (
                <Link
                  key={project.id}
                  href={`/projects/${project.id}`}
                  className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted transition-colors"
                >
                  <FolderKanban
                    className="h-4 w-4"
                    style={project.color ? { color: project.color } : undefined}
                  />
                  <span className="font-medium">{project.name}</span>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-4">
              No projects in this area yet
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
