"use client";

import { useState } from "react";
import { Star, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import type { SearchFilters } from "./search-filters-sidebar";

interface SaveSearchDialogProps {
  open: boolean;
  onClose: () => void;
  query: string;
  filters?: SearchFilters;
}

export function SaveSearchDialog({
  open,
  onClose,
  query,
  filters,
}: SaveSearchDialogProps) {
  const [name, setName] = useState("");
  const utils = trpc.useUtils();

  const saveSearch = trpc.search.saveSearch.useMutation({
    onSuccess: () => {
      utils.search.getSavedSearches.invalidate();
      onClose();
      setName("");
    },
  });

  const handleClose = () => {
    onClose();
    setName("");
  };

  const hasFilters = filters && Object.keys(filters).some((key) => {
    const value = filters[key as keyof SearchFilters];
    return value !== undefined && (Array.isArray(value) ? value.length > 0 : true);
  });

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Save Search</DialogTitle>
          <DialogDescription>
            Save this search for quick access later
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="search-name">Name</Label>
            <Input
              id="search-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Project X tasks"
              autoFocus
            />
          </div>

          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-sm font-medium text-gray-700">Search query</p>
            <p className="text-sm text-gray-500 mt-1">&quot;{query}&quot;</p>
            {hasFilters && (
              <>
                <p className="text-sm font-medium text-gray-700 mt-3">Filters</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {filters?.types?.map((type) => (
                    <Badge key={type} variant="secondary" className="text-xs">
                      {type.toLowerCase().replace("_", " ")}
                    </Badge>
                  ))}
                  {filters?.projectId && (
                    <Badge variant="secondary" className="text-xs">
                      Project filter
                    </Badge>
                  )}
                  {filters?.areaId && (
                    <Badge variant="secondary" className="text-xs">
                      Area filter
                    </Badge>
                  )}
                  {filters?.dateFrom && (
                    <Badge variant="secondary" className="text-xs">
                      Date from filter
                    </Badge>
                  )}
                  {filters?.dateTo && (
                    <Badge variant="secondary" className="text-xs">
                      Date to filter
                    </Badge>
                  )}
                  {filters?.tags?.map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-xs">
                      #{tag}
                    </Badge>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={() => saveSearch.mutate({ name, query, filters })}
            disabled={!name.trim() || saveSearch.isPending}
          >
            {saveSearch.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Star className="h-4 w-4 mr-2" />
            )}
            Save Search
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
