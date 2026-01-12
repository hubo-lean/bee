"use client";

import { History, Star, X, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import type { SearchFilters } from "./search-filters-sidebar";

interface RecentSearchesProps {
  onSelect: (query: string, filters?: SearchFilters) => void;
}

export function RecentSearches({ onSelect }: RecentSearchesProps) {
  const { data: recentSearches, refetch: refetchRecent } =
    trpc.search.getRecentSearches.useQuery({ limit: 10 });
  const { data: savedSearches, refetch: refetchSaved } =
    trpc.search.getSavedSearches.useQuery();

  const clearHistory = trpc.search.clearHistory.useMutation({
    onSuccess: () => {
      refetchRecent();
    },
  });

  const deleteSavedSearch = trpc.search.deleteSavedSearch.useMutation({
    onSuccess: () => {
      refetchSaved();
    },
  });

  if (!recentSearches?.length && !savedSearches?.length) {
    return (
      <div className="text-center py-8 text-gray-500">
        <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No recent searches</p>
        <p className="text-xs mt-1">Your search history will appear here</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Saved Searches */}
      {savedSearches && savedSearches.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-700">Saved Searches</h3>
          </div>
          <div className="space-y-1">
            {savedSearches.map((search) => (
              <div
                key={search.id}
                className="group w-full flex items-center gap-2 px-3 py-2 text-left text-sm rounded-lg hover:bg-gray-100"
              >
                <button
                  onClick={() => onSelect(search.query, search.filters)}
                  className="flex items-center gap-2 flex-1 min-w-0"
                >
                  <Star className="h-4 w-4 text-yellow-500 flex-shrink-0" />
                  <span className="font-medium truncate">{search.name}</span>
                  <span className="text-gray-400 truncate">{search.query}</span>
                </button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteSavedSearch.mutate({ id: search.id });
                  }}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Searches */}
      {recentSearches && recentSearches.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-700">Recent Searches</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => clearHistory.mutate()}
              className="text-gray-400 hover:text-gray-600 h-7 px-2"
              disabled={clearHistory.isPending}
            >
              <Trash2 className="h-3 w-3 mr-1" />
              Clear
            </Button>
          </div>
          <div className="space-y-1">
            {recentSearches.map((search) => (
              <button
                key={search.id}
                onClick={() => onSelect(search.query, search.filters)}
                className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm rounded-lg hover:bg-gray-100"
              >
                <History className="h-4 w-4 text-gray-400 flex-shrink-0" />
                <span className="truncate flex-1">{search.query}</span>
                <span className="ml-auto text-xs text-gray-400 flex-shrink-0">
                  {formatDistanceToNow(search.searchedAt, { addSuffix: true })}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
