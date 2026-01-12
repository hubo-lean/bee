"use client";

import { useState } from "react";
import { Plus, FileText, Link2, File, FolderOpen, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";

const RESOURCE_TYPES = [
  { value: "all", label: "All", icon: FolderOpen },
  { value: "note", label: "Notes", icon: FileText },
  { value: "link", label: "Links", icon: Link2 },
  { value: "file", label: "Files", icon: File },
];

function getResourceIcon(type: string) {
  switch (type) {
    case "note":
      return <FileText className="h-4 w-4" />;
    case "link":
      return <Link2 className="h-4 w-4" />;
    case "file":
      return <File className="h-4 w-4" />;
    default:
      return <FolderOpen className="h-4 w-4" />;
  }
}

export default function ResourcesPage() {
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const { data: resources, isLoading } = trpc.para.listResources.useQuery(
    typeFilter === "all"
      ? undefined
      : { type: typeFilter as "note" | "link" | "file" | "collection" }
  );

  const utils = trpc.useUtils();
  const updateResource = trpc.para.updateResource.useMutation({
    onSuccess: () => {
      utils.para.listResources.invalidate();
    },
  });

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Resources</h1>
          <p className="text-muted-foreground">
            Reference materials and collections
          </p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Add Resource
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={typeFilter} onValueChange={setTypeFilter}>
        <TabsList>
          {RESOURCE_TYPES.map((type) => (
            <TabsTrigger key={type.value} value={type.value}>
              <type.icon className="h-4 w-4 mr-2" />
              {type.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={typeFilter} className="mt-6">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : resources && resources.length > 0 ? (
            <div className="space-y-3">
              {resources.map((resource) => (
                <Card key={resource.id}>
                  <CardContent className="py-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className="mt-1 text-muted-foreground">
                          {getResourceIcon(resource.type)}
                        </div>
                        <div>
                          <p className="font-medium">{resource.name}</p>
                          {resource.description && (
                            <p className="text-sm text-muted-foreground line-clamp-2">
                              {resource.description}
                            </p>
                          )}
                          {resource.area && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {resource.area.icon} {resource.area.name}
                            </p>
                          )}
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>Edit</DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              updateResource.mutate({
                                id: resource.id,
                                isArchived: true,
                              })
                            }
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
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <FolderOpen className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground">No resources yet</p>
                <p className="text-sm text-muted-foreground">
                  Add resources to save reference materials
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
