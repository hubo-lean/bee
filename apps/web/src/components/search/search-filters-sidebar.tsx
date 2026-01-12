"use client";

import { SearchSourceType } from "@packages/db";
import { Inbox, FileText, CheckSquare, Link2 } from "lucide-react";
import { format, subDays } from "date-fns";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";

export interface SearchFilters {
  types?: SearchSourceType[];
  projectId?: string;
  areaId?: string;
  tags?: string[];
  dateFrom?: Date;
  dateTo?: Date;
}

interface SearchFiltersSidebarProps {
  filters: SearchFilters;
  onChange: (filters: SearchFilters) => void;
}

const CONTENT_TYPES = [
  { value: "INBOX_ITEM" as const, label: "Inbox Items", icon: Inbox },
  { value: "NOTE" as const, label: "Notes", icon: FileText },
  { value: "ACTION" as const, label: "Actions", icon: CheckSquare },
  { value: "RESOURCE" as const, label: "Resources", icon: Link2 },
];

const DATE_PRESETS = [
  { label: "Today", days: 0 },
  { label: "7 days", days: 7 },
  { label: "30 days", days: 30 },
  { label: "90 days", days: 90 },
];

export function SearchFiltersSidebar({
  filters,
  onChange,
}: SearchFiltersSidebarProps) {
  const { data: projects } = trpc.para.listProjects.useQuery({ status: "active" });
  const { data: areas } = trpc.para.listAreas.useQuery();

  const updateFilter = <K extends keyof SearchFilters>(
    key: K,
    value: SearchFilters[K]
  ) => {
    onChange({ ...filters, [key]: value });
  };

  const clearFilters = () => {
    onChange({});
  };

  const hasFilters = Object.values(filters).some(
    (v) => v !== undefined && (Array.isArray(v) ? v.length > 0 : true)
  );

  const handleTypeChange = (type: SearchSourceType, checked: boolean) => {
    const current = filters.types || [];
    if (checked) {
      updateFilter("types", [...current, type]);
    } else {
      updateFilter(
        "types",
        current.filter((t) => t !== type)
      );
    }
  };

  const handleDatePreset = (days: number) => {
    const now = new Date();
    if (days === 0) {
      // Today - set from start of day to end of day
      const startOfDay = new Date(now);
      startOfDay.setHours(0, 0, 0, 0);
      updateFilter("dateFrom", startOfDay);
      updateFilter("dateTo", now);
    } else {
      updateFilter("dateFrom", subDays(now, days));
      updateFilter("dateTo", now);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with clear button */}
      <div className="flex items-center justify-between">
        <h3 className="font-medium">Filters</h3>
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            Clear all
          </Button>
        )}
      </div>

      {/* Content Type Filter */}
      <div>
        <Label className="text-sm font-medium">Content Type</Label>
        <div className="mt-2 space-y-2">
          {CONTENT_TYPES.map(({ value, label, icon: Icon }) => (
            <div key={value} className="flex items-center">
              <Checkbox
                id={`type-${value}`}
                checked={filters.types?.includes(value) || false}
                onCheckedChange={(checked) =>
                  handleTypeChange(value, checked === true)
                }
              />
              <label
                htmlFor={`type-${value}`}
                className="ml-2 flex items-center gap-2 text-sm cursor-pointer"
              >
                <Icon className="h-4 w-4 text-gray-500" />
                {label}
              </label>
            </div>
          ))}
        </div>
      </div>

      {/* Project Filter */}
      <div>
        <Label className="text-sm font-medium">Project</Label>
        <Select
          value={filters.projectId || "all"}
          onValueChange={(value) =>
            updateFilter("projectId", value === "all" ? undefined : value)
          }
        >
          <SelectTrigger className="mt-2">
            <SelectValue placeholder="All projects" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All projects</SelectItem>
            {projects?.map((project) => (
              <SelectItem key={project.id} value={project.id}>
                {project.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Area Filter */}
      <div>
        <Label className="text-sm font-medium">Area</Label>
        <Select
          value={filters.areaId || "all"}
          onValueChange={(value) =>
            updateFilter("areaId", value === "all" ? undefined : value)
          }
        >
          <SelectTrigger className="mt-2">
            <SelectValue placeholder="All areas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All areas</SelectItem>
            {areas?.map((area) => (
              <SelectItem key={area.id} value={area.id}>
                {area.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Date Range Filter */}
      <div>
        <Label className="text-sm font-medium">Date Range</Label>
        <div className="mt-2 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs text-gray-500">From</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                    size="sm"
                  >
                    {filters.dateFrom
                      ? format(filters.dateFrom, "MMM d, yyyy")
                      : "Start date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={filters.dateFrom}
                    onSelect={(date) => updateFilter("dateFrom", date)}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label className="text-xs text-gray-500">To</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                    size="sm"
                  >
                    {filters.dateTo
                      ? format(filters.dateTo, "MMM d, yyyy")
                      : "End date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={filters.dateTo}
                    onSelect={(date) => updateFilter("dateTo", date)}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          {/* Quick date presets */}
          <div className="flex flex-wrap gap-1">
            {DATE_PRESETS.map(({ label, days }) => (
              <Button
                key={days}
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => handleDatePreset(days)}
              >
                {label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Tags Filter - simplified since tags aren't a separate table */}
      {filters.tags && filters.tags.length > 0 && (
        <div>
          <Label className="text-sm font-medium">Active Tags</Label>
          <div className="mt-2 flex flex-wrap gap-1">
            {filters.tags.map((tag) => (
              <Badge
                key={tag}
                variant="default"
                className="cursor-pointer"
                onClick={() => {
                  updateFilter(
                    "tags",
                    filters.tags?.filter((t) => t !== tag)
                  );
                }}
              >
                #{tag} &times;
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
