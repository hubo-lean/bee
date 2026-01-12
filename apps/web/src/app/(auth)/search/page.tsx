"use client";

import { useState } from "react";
import { Search, Loader2, Star } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  SearchResultCard,
  SearchFiltersSidebar,
  RecentSearches,
  SaveSearchDialog,
  ActiveFilters,
  type SearchFilters,
} from "@/components/search";
import { trpc } from "@/lib/trpc";
import { useDebounce } from "@/lib/hooks/use-debounce";

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<SearchFilters>({});
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const debouncedQuery = useDebounce(query, 300);

  const hasFilters = Object.values(filters).some(
    (v) => v !== undefined && (Array.isArray(v) ? v.length > 0 : true)
  );

  const { data: results, isLoading } = trpc.search.search.useQuery(
    {
      query: debouncedQuery,
      filters: hasFilters ? filters : undefined,
    },
    { enabled: debouncedQuery.length >= 2 }
  );

  const handleSelectFromHistory = (q: string, f?: SearchFilters) => {
    setQuery(q);
    if (f) setFilters(f);
  };

  const handleRemoveFilter = <K extends keyof SearchFilters>(
    key: K,
    value?: string
  ) => {
    if (key === "types" && value) {
      setFilters({
        ...filters,
        types: filters.types?.filter((t) => t !== value),
      });
    } else if (key === "tags" && value) {
      setFilters({
        ...filters,
        tags: filters.tags?.filter((t) => t !== value),
      });
    } else {
      const newFilters = { ...filters };
      delete newFilters[key];
      setFilters(newFilters);
    }
  };

  return (
    <div className="container max-w-6xl py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Search</h1>
          <p className="text-gray-500 mt-1">
            Search across all your content by meaning, not just keywords
          </p>
        </div>
        {query && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowSaveDialog(true)}
          >
            <Star className="h-4 w-4 mr-2" />
            Save Search
          </Button>
        )}
      </div>

      {/* Search Input */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
        <Input
          type="search"
          placeholder="Search by meaning, not just keywords..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-10 h-12 text-lg"
          autoFocus
        />
      </div>

      {/* Active Filters */}
      <ActiveFilters
        filters={filters}
        onRemove={handleRemoveFilter}
        onClear={() => setFilters({})}
      />

      <div className="flex gap-6 mt-6">
        {/* Filters Sidebar */}
        <div className="w-64 shrink-0 space-y-6">
          <SearchFiltersSidebar filters={filters} onChange={setFilters} />

          {/* Recent & Saved Searches (when no query) */}
          {!query && (
            <div className="border-t pt-6">
              <RecentSearches onSelect={handleSelectFromHistory} />
            </div>
          )}
        </div>

        {/* Results */}
        <div className="flex-1 min-w-0">
          {/* Results Count */}
          {query.length >= 2 && results && (
            <p className="text-sm text-gray-500 mb-4">
              {results.length} result{results.length !== 1 ? "s" : ""} found
            </p>
          )}

          {/* Loading State */}
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          )}

          {/* No Results */}
          {!isLoading && query.length >= 2 && (!results || results.length === 0) && (
            <div className="text-center py-12">
              <Search className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-700">No results found</h3>
              <p className="text-gray-500 mt-1">
                Try different keywords or adjust your filters
              </p>
            </div>
          )}

          {/* Results List */}
          {!isLoading && results && results.length > 0 && (
            <div className="space-y-4">
              {results.map((result) => (
                <SearchResultCard key={result.id} result={result} query={query} />
              ))}
            </div>
          )}

          {/* Empty State - No Query */}
          {query.length < 2 && (
            <div className="text-center py-12">
              <Search className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-700">
                Start typing to search
              </h3>
              <p className="text-gray-500 mt-1">
                Enter at least 2 characters to begin searching
              </p>
              <p className="text-sm text-gray-400 mt-4">
                Tip: Use{" "}
                <kbd className="px-2 py-1 bg-gray-100 rounded text-xs">Cmd+K</kbd>{" "}
                to search from anywhere
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Save Search Dialog */}
      <SaveSearchDialog
        open={showSaveDialog}
        onClose={() => setShowSaveDialog(false)}
        query={query}
        filters={filters}
      />
    </div>
  );
}
