"use client";

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { SearchFilters } from "./search-filters-sidebar";

interface ActiveFiltersProps {
  filters: SearchFilters;
  onRemove: <K extends keyof SearchFilters>(key: K, value?: string) => void;
  onClear: () => void;
}

export function ActiveFilters({
  filters,
  onRemove,
  onClear,
}: ActiveFiltersProps) {
  const activeCount =
    (filters.types?.length || 0) +
    (filters.projectId ? 1 : 0) +
    (filters.areaId ? 1 : 0) +
    (filters.tags?.length || 0) +
    (filters.dateFrom || filters.dateTo ? 1 : 0);

  if (activeCount === 0) return null;

  return (
    <div className="flex items-center gap-2 flex-wrap py-2">
      <span className="text-sm text-gray-500">Active filters:</span>

      {filters.types?.map((type) => (
        <Badge
          key={type}
          variant="secondary"
          className="cursor-pointer hover:bg-gray-200"
          onClick={() => onRemove("types", type)}
        >
          {type.toLowerCase().replace("_", " ")}
          <X className="h-3 w-3 ml-1" />
        </Badge>
      ))}

      {filters.projectId && (
        <Badge
          variant="secondary"
          className="cursor-pointer hover:bg-gray-200"
          onClick={() => onRemove("projectId")}
        >
          Project
          <X className="h-3 w-3 ml-1" />
        </Badge>
      )}

      {filters.areaId && (
        <Badge
          variant="secondary"
          className="cursor-pointer hover:bg-gray-200"
          onClick={() => onRemove("areaId")}
        >
          Area
          <X className="h-3 w-3 ml-1" />
        </Badge>
      )}

      {(filters.dateFrom || filters.dateTo) && (
        <Badge
          variant="secondary"
          className="cursor-pointer hover:bg-gray-200"
          onClick={() => {
            onRemove("dateFrom");
            onRemove("dateTo");
          }}
        >
          Date range
          <X className="h-3 w-3 ml-1" />
        </Badge>
      )}

      {filters.tags?.map((tag) => (
        <Badge
          key={tag}
          variant="secondary"
          className="cursor-pointer hover:bg-gray-200"
          onClick={() => onRemove("tags", tag)}
        >
          #{tag}
          <X className="h-3 w-3 ml-1" />
        </Badge>
      ))}

      <Button variant="ghost" size="sm" onClick={onClear} className="h-6 px-2">
        Clear all
      </Button>
    </div>
  );
}
