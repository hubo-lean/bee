# Story 6.5: Search Filters & History

## Story

**As a** user,
**I want** to filter search results and access my recent searches,
**So that** I can quickly find specific content.

## Priority

**P1** - Enhances search UX, not blocking core functionality

## Acceptance Criteria

1. Filter by content type (inbox items, notes, actions, resources)
2. Filter by PARA category (project, area)
3. Filter by date range
4. Filter by tags
5. Recent searches saved and displayed
6. Clear search history option
7. Saved searches for frequent queries

## Technical Design

### Search Filters Sidebar Component

```tsx
interface SearchFilters {
  types?: SearchSourceType[];
  projectId?: string;
  areaId?: string;
  tags?: string[];
  dateFrom?: Date;
  dateTo?: Date;
}

function SearchFiltersSidebar({
  filters,
  onChange,
}: {
  filters: SearchFilters;
  onChange: (filters: SearchFilters) => void;
}) {
  const { data: projects } = trpc.para.getProjects.useQuery();
  const { data: areas } = trpc.para.getAreas.useQuery();
  const { data: tags } = trpc.tags.getAll.useQuery();

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
          {[
            { value: "INBOX_ITEM", label: "Inbox Items", icon: Inbox },
            { value: "NOTE", label: "Notes", icon: FileText },
            { value: "ACTION", label: "Actions", icon: CheckSquare },
            { value: "RESOURCE", label: "Resources", icon: Link2 },
          ].map(({ value, label, icon: Icon }) => (
            <div key={value} className="flex items-center">
              <Checkbox
                id={`type-${value}`}
                checked={filters.types?.includes(value as SearchSourceType)}
                onCheckedChange={(checked) => {
                  const current = filters.types || [];
                  if (checked) {
                    updateFilter("types", [...current, value as SearchSourceType]);
                  } else {
                    updateFilter(
                      "types",
                      current.filter((t) => t !== value)
                    );
                  }
                }}
              />
              <label
                htmlFor={`type-${value}`}
                className="ml-2 flex items-center gap-2 text-sm"
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
          value={filters.projectId || ""}
          onValueChange={(value) =>
            updateFilter("projectId", value || undefined)
          }
        >
          <SelectTrigger className="mt-2">
            <SelectValue placeholder="All projects" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All projects</SelectItem>
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
          value={filters.areaId || ""}
          onValueChange={(value) =>
            updateFilter("areaId", value || undefined)
          }
        >
          <SelectTrigger className="mt-2">
            <SelectValue placeholder="All areas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All areas</SelectItem>
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
                <PopoverContent className="w-auto p-0">
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
                <PopoverContent className="w-auto p-0">
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
            {[
              { label: "Today", days: 0 },
              { label: "7 days", days: 7 },
              { label: "30 days", days: 30 },
              { label: "90 days", days: 90 },
            ].map(({ label, days }) => (
              <Button
                key={days}
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => {
                  updateFilter("dateFrom", subDays(new Date(), days));
                  updateFilter("dateTo", new Date());
                }}
              >
                {label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Tags Filter */}
      <div>
        <Label className="text-sm font-medium">Tags</Label>
        <div className="mt-2 flex flex-wrap gap-1 max-h-32 overflow-y-auto">
          {tags?.map((tag) => (
            <Badge
              key={tag.id}
              variant={filters.tags?.includes(tag.name) ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => {
                const current = filters.tags || [];
                if (current.includes(tag.name)) {
                  updateFilter(
                    "tags",
                    current.filter((t) => t !== tag.name)
                  );
                } else {
                  updateFilter("tags", [...current, tag.name]);
                }
              }}
            >
              {tag.name}
            </Badge>
          ))}
        </div>
      </div>
    </div>
  );
}
```

### Search History Model

```prisma
model SearchHistory {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  query     String
  filters   Json?    // Stored filters for this search

  searchedAt DateTime @default(now())

  @@index([userId, searchedAt(sort: Desc)])
}

model SavedSearch {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  name      String
  query     String
  filters   Json?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([userId])
}
```

### Search History Service

```typescript
const MAX_HISTORY_ITEMS = 50;

export async function saveSearchHistory(
  userId: string,
  query: string,
  filters?: SearchFilters
): Promise<void> {
  // Check if same search exists recently (within 1 hour)
  const recentSame = await prisma.searchHistory.findFirst({
    where: {
      userId,
      query,
      searchedAt: { gte: subHours(new Date(), 1) },
    },
  });

  if (recentSame) {
    // Update timestamp instead of creating new
    await prisma.searchHistory.update({
      where: { id: recentSame.id },
      data: { searchedAt: new Date() },
    });
    return;
  }

  // Create new history entry
  await prisma.searchHistory.create({
    data: {
      userId,
      query,
      filters: filters ? JSON.stringify(filters) : null,
    },
  });

  // Prune old entries
  const count = await prisma.searchHistory.count({ where: { userId } });
  if (count > MAX_HISTORY_ITEMS) {
    const oldestToKeep = await prisma.searchHistory.findMany({
      where: { userId },
      orderBy: { searchedAt: "desc" },
      take: MAX_HISTORY_ITEMS,
      select: { id: true },
    });

    await prisma.searchHistory.deleteMany({
      where: {
        userId,
        id: { notIn: oldestToKeep.map((h) => h.id) },
      },
    });
  }
}

export async function getRecentSearches(
  userId: string,
  limit: number = 10
): Promise<{ query: string; filters?: SearchFilters; searchedAt: Date }[]> {
  const history = await prisma.searchHistory.findMany({
    where: { userId },
    orderBy: { searchedAt: "desc" },
    take: limit,
  });

  return history.map((h) => ({
    query: h.query,
    filters: h.filters ? JSON.parse(h.filters as string) : undefined,
    searchedAt: h.searchedAt,
  }));
}

export async function clearSearchHistory(userId: string): Promise<void> {
  await prisma.searchHistory.deleteMany({ where: { userId } });
}
```

### Saved Searches Service

```typescript
interface SavedSearchInput {
  name: string;
  query: string;
  filters?: SearchFilters;
}

export async function createSavedSearch(
  userId: string,
  input: SavedSearchInput
): Promise<SavedSearch> {
  return prisma.savedSearch.create({
    data: {
      userId,
      name: input.name,
      query: input.query,
      filters: input.filters ? JSON.stringify(input.filters) : null,
    },
  });
}

export async function getSavedSearches(userId: string): Promise<SavedSearch[]> {
  return prisma.savedSearch.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
}

export async function deleteSavedSearch(
  userId: string,
  searchId: string
): Promise<void> {
  await prisma.savedSearch.delete({
    where: { id: searchId, userId },
  });
}
```

### Recent Searches Component

```tsx
function RecentSearches({
  onSelect,
}: {
  onSelect: (query: string, filters?: SearchFilters) => void;
}) {
  const { data: recentSearches } = trpc.search.getRecentSearches.useQuery();
  const { data: savedSearches } = trpc.search.getSavedSearches.useQuery();
  const clearHistory = trpc.search.clearHistory.useMutation();

  if (!recentSearches?.length && !savedSearches?.length) {
    return null;
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
              <button
                key={search.id}
                onClick={() =>
                  onSelect(
                    search.query,
                    search.filters ? JSON.parse(search.filters as string) : undefined
                  )
                }
                className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm rounded-lg hover:bg-gray-100"
              >
                <Star className="h-4 w-4 text-yellow-500" />
                <span className="font-medium">{search.name}</span>
                <span className="text-gray-400 truncate">{search.query}</span>
              </button>
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
              className="text-gray-400 hover:text-gray-600"
            >
              Clear
            </Button>
          </div>
          <div className="space-y-1">
            {recentSearches.map((search, index) => (
              <button
                key={index}
                onClick={() => onSelect(search.query, search.filters)}
                className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm rounded-lg hover:bg-gray-100"
              >
                <History className="h-4 w-4 text-gray-400" />
                <span className="truncate">{search.query}</span>
                <span className="ml-auto text-xs text-gray-400">
                  {formatRelative(search.searchedAt, new Date())}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

### Save Search Dialog

```tsx
function SaveSearchDialog({
  open,
  onClose,
  query,
  filters,
}: {
  open: boolean;
  onClose: () => void;
  query: string;
  filters?: SearchFilters;
}) {
  const [name, setName] = useState("");
  const saveSearch = trpc.search.saveSearch.useMutation({
    onSuccess: () => {
      onClose();
      setName("");
    },
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Save Search</DialogTitle>
          <DialogDescription>
            Save this search for quick access later
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Project X tasks"
            />
          </div>

          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-sm font-medium text-gray-700">Search query</p>
            <p className="text-sm text-gray-500">{query}</p>
            {filters && Object.keys(filters).length > 0 && (
              <>
                <p className="text-sm font-medium text-gray-700 mt-2">Filters</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {filters.types?.map((type) => (
                    <Badge key={type} variant="secondary" className="text-xs">
                      {type.toLowerCase().replace("_", " ")}
                    </Badge>
                  ))}
                  {filters.projectId && (
                    <Badge variant="secondary" className="text-xs">
                      Project filter
                    </Badge>
                  )}
                  {filters.areaId && (
                    <Badge variant="secondary" className="text-xs">
                      Area filter
                    </Badge>
                  )}
                  {filters.tags?.map((tag) => (
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
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() =>
              saveSearch.mutate({ name, query, filters })
            }
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
```

### Active Filters Display

```tsx
function ActiveFilters({
  filters,
  onRemove,
  onClear,
}: {
  filters: SearchFilters;
  onRemove: <K extends keyof SearchFilters>(key: K, value?: string) => void;
  onClear: () => void;
}) {
  const activeCount =
    (filters.types?.length || 0) +
    (filters.projectId ? 1 : 0) +
    (filters.areaId ? 1 : 0) +
    (filters.tags?.length || 0) +
    (filters.dateFrom || filters.dateTo ? 1 : 0);

  if (activeCount === 0) return null;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-sm text-gray-500">Active filters:</span>

      {filters.types?.map((type) => (
        <Badge
          key={type}
          variant="secondary"
          className="cursor-pointer"
          onClick={() => onRemove("types", type)}
        >
          {type.toLowerCase().replace("_", " ")}
          <X className="h-3 w-3 ml-1" />
        </Badge>
      ))}

      {filters.projectId && (
        <Badge
          variant="secondary"
          className="cursor-pointer"
          onClick={() => onRemove("projectId")}
        >
          Project
          <X className="h-3 w-3 ml-1" />
        </Badge>
      )}

      {filters.areaId && (
        <Badge
          variant="secondary"
          className="cursor-pointer"
          onClick={() => onRemove("areaId")}
        >
          Area
          <X className="h-3 w-3 ml-1" />
        </Badge>
      )}

      {(filters.dateFrom || filters.dateTo) && (
        <Badge
          variant="secondary"
          className="cursor-pointer"
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
          className="cursor-pointer"
          onClick={() => onRemove("tags", tag)}
        >
          #{tag}
          <X className="h-3 w-3 ml-1" />
        </Badge>
      ))}

      <Button variant="ghost" size="sm" onClick={onClear}>
        Clear all
      </Button>
    </div>
  );
}
```

### tRPC Procedures

```typescript
export const searchRouter = router({
  // ... existing search procedure ...

  getRecentSearches: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(50).default(10),
    }).optional())
    .query(async ({ ctx, input }) => {
      return getRecentSearches(ctx.session.user.id, input?.limit);
    }),

  clearHistory: protectedProcedure
    .mutation(async ({ ctx }) => {
      await clearSearchHistory(ctx.session.user.id);
      return { success: true };
    }),

  getSavedSearches: protectedProcedure
    .query(async ({ ctx }) => {
      return getSavedSearches(ctx.session.user.id);
    }),

  saveSearch: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(100),
      query: z.string().min(1),
      filters: z.object({
        types: z.array(z.nativeEnum(SearchSourceType)).optional(),
        projectId: z.string().optional(),
        areaId: z.string().optional(),
        tags: z.array(z.string()).optional(),
        dateFrom: z.date().optional(),
        dateTo: z.date().optional(),
      }).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return createSavedSearch(ctx.session.user.id, input);
    }),

  deleteSavedSearch: protectedProcedure
    .input(z.object({
      id: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      await deleteSavedSearch(ctx.session.user.id, input.id);
      return { success: true };
    }),
});

// Modify existing search procedure to save history
search: protectedProcedure
  .input(searchInputSchema)
  .query(async ({ ctx, input }) => {
    // Save to history (async, don't block)
    saveSearchHistory(ctx.session.user.id, input.query, input.filters)
      .catch(console.error);

    return semanticSearch(
      ctx.session.user.id,
      input.query,
      input.filters,
      input.limit
    );
  }),
```

### Updated Search Page with Filters & History

```tsx
// apps/web/src/app/(app)/search/page.tsx
"use client";

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<SearchFilters>({});
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const debouncedQuery = useDebounce(query, 300);

  const { data: results, isLoading } = trpc.search.search.useQuery(
    { query: debouncedQuery, filters },
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
    <div className="container max-w-5xl py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Search</h1>
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
          <SearchFiltersSidebar
            filters={filters}
            onChange={setFilters}
          />

          {/* Recent & Saved Searches (when no query) */}
          {!query && (
            <RecentSearches onSelect={handleSelectFromHistory} />
          )}
        </div>

        {/* Results */}
        <div className="flex-1">
          {/* ... results display ... */}
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
```

## Dependencies

- Story 6.4 (Semantic Search Implementation)
- Story 5.3 (PARA Structure for project/area filters)

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/db/prisma/schema.prisma` | Modify | Add SearchHistory, SavedSearch models |
| `apps/web/src/server/services/search-history.service.ts` | Create | History management |
| `apps/web/src/server/routers/search.ts` | Modify | Add history/saved search procedures |
| `apps/web/src/components/search/search-filters-sidebar.tsx` | Create | Filter controls |
| `apps/web/src/components/search/recent-searches.tsx` | Create | History display |
| `apps/web/src/components/search/save-search-dialog.tsx` | Create | Save search modal |
| `apps/web/src/components/search/active-filters.tsx` | Create | Active filter badges |
| `apps/web/src/app/(app)/search/page.tsx` | Modify | Integrate filters & history |

## Testing Checklist

- [ ] Type filter narrows results correctly
- [ ] Project filter shows only matching items
- [ ] Area filter shows only matching items
- [ ] Tag filter shows items with selected tags
- [ ] Date range filter respects boundaries
- [ ] Multiple filters combine correctly (AND logic)
- [ ] Recent searches saved automatically
- [ ] Recent searches deduplicated within 1 hour
- [ ] Clear history removes all entries
- [ ] Saved searches persist across sessions
- [ ] Saved search can be deleted
- [ ] Filter presets (today, 7 days, etc.) work

## Definition of Done

- [ ] Filter sidebar component with all filter types
- [ ] Content type filter (checkboxes)
- [ ] Project/Area dropdowns
- [ ] Date range picker with presets
- [ ] Tag filter badges
- [ ] Active filter display with remove buttons
- [ ] Search history auto-saving
- [ ] Recent searches display
- [ ] Clear history functionality
- [ ] Save search feature
- [ ] Saved searches list
- [ ] TypeScript/ESLint pass
- [ ] Unit tests for filter logic

---

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-01-11 | 1.0 | Initial story specification | Bob (SM) |
