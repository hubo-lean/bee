"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Circle, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";

export default function AreasPage() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newAreaName, setNewAreaName] = useState("");
  const [newAreaDescription, setNewAreaDescription] = useState("");
  const [newAreaIcon, setNewAreaIcon] = useState("");

  const utils = trpc.useUtils();
  const { data: areas, isLoading, isError, refetch } = trpc.para.listAreas.useQuery();

  const createArea = trpc.para.createArea.useMutation({
    onSuccess: () => {
      utils.para.listAreas.invalidate();
      setIsCreateOpen(false);
      setNewAreaName("");
      setNewAreaDescription("");
      setNewAreaIcon("");
    },
  });

  const deleteArea = trpc.para.deleteArea.useMutation({
    onSuccess: () => {
      utils.para.listAreas.invalidate();
    },
  });

  const handleCreateArea = () => {
    if (!newAreaName.trim()) return;
    createArea.mutate({
      name: newAreaName.trim(),
      description: newAreaDescription.trim() || undefined,
      icon: newAreaIcon.trim() || undefined,
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
        <p className="text-muted-foreground">Failed to load areas</p>
        <Button variant="link" onClick={() => refetch()} className="mt-2">
          Try again
        </Button>
      </div>
    );
  }

  // Empty state
  if (!areas || areas.length === 0) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Areas</h1>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                New Area
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Area</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={newAreaName}
                    onChange={(e) => setNewAreaName(e.target.value)}
                    placeholder="Area name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="icon">Icon (emoji, optional)</Label>
                  <Input
                    id="icon"
                    value={newAreaIcon}
                    onChange={(e) => setNewAreaIcon(e.target.value)}
                    placeholder="e.g., \uD83C\uDFE0"
                    maxLength={10}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description (optional)</Label>
                  <Textarea
                    id="description"
                    value={newAreaDescription}
                    onChange={(e) => setNewAreaDescription(e.target.value)}
                    placeholder="Brief description"
                  />
                </div>
                <Button
                  onClick={handleCreateArea}
                  disabled={!newAreaName.trim() || createArea.isPending}
                  className="w-full"
                >
                  {createArea.isPending ? "Creating..." : "Create Area"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardContent className="py-16 text-center">
            <Circle className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
            <h2 className="text-lg font-semibold mb-2">No areas yet</h2>
            <p className="text-muted-foreground mb-4">
              Create areas to organize your life responsibilities (Work, Health, Family, etc.)
            </p>
            <Button onClick={() => setIsCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Area
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Areas list
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Areas</h1>
          <p className="text-sm text-muted-foreground">{areas.length} areas of responsibility</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Area
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Area</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={newAreaName}
                  onChange={(e) => setNewAreaName(e.target.value)}
                  placeholder="Area name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="icon">Icon (emoji, optional)</Label>
                <Input
                  id="icon"
                  value={newAreaIcon}
                  onChange={(e) => setNewAreaIcon(e.target.value)}
                  placeholder="e.g., \uD83C\uDFE0"
                  maxLength={10}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description (optional)</Label>
                <Textarea
                  id="description"
                  value={newAreaDescription}
                  onChange={(e) => setNewAreaDescription(e.target.value)}
                  placeholder="Brief description"
                />
              </div>
              <Button
                onClick={handleCreateArea}
                disabled={!newAreaName.trim() || createArea.isPending}
                className="w-full"
              >
                {createArea.isPending ? "Creating..." : "Create Area"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Areas Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {areas.map((area) => (
          <Card key={area.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <Link
                  href={`/areas/${area.id}`}
                  className="flex-1 group"
                >
                  <div className="flex items-center gap-2 mb-2">
                    {area.icon ? (
                      <span className="text-2xl">{area.icon}</span>
                    ) : (
                      <Circle
                        className="h-5 w-5"
                        style={area.color ? { color: area.color } : undefined}
                      />
                    )}
                    <h3
                      className="font-semibold group-hover:text-primary transition-colors"
                      style={area.color ? { color: area.color } : undefined}
                    >
                      {area.name}
                    </h3>
                  </div>
                  {area.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                      {area.description}
                    </p>
                  )}
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>{area._count?.actions || 0} actions</span>
                    <span>{area._count?.notes || 0} notes</span>
                    <span>{area._count?.projects || 0} projects</span>
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
                      <Link href={`/areas/${area.id}`}>View Details</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem>Edit</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => {
                        if (confirm("Are you sure you want to delete this area?")) {
                          deleteArea.mutate({ id: area.id });
                        }
                      }}
                    >
                      Delete
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
