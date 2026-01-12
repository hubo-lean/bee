"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  FileText,
  CheckSquare,
  Inbox,
  Link2,
  Loader2,
  Plus,
  MessageSquare,
} from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { trpc } from "@/lib/trpc";
import { useDebounce } from "@/lib/hooks/use-debounce";
import type { SearchSourceType } from "@packages/db";

const SOURCE_TYPE_ICONS: Record<SearchSourceType, typeof Inbox> = {
  INBOX_ITEM: Inbox,
  NOTE: FileText,
  ACTION: CheckSquare,
  RESOURCE: Link2,
  CONVERSATION: MessageSquare,
};

const SOURCE_TYPE_LABELS: Record<SearchSourceType, string> = {
  INBOX_ITEM: "Inbox Item",
  NOTE: "Note",
  ACTION: "Action",
  RESOURCE: "Resource",
  CONVERSATION: "Conversation",
};

interface SearchResult {
  id: string;
  sourceType: SearchSourceType;
  sourceId: string;
  title: string | null;
  snippet: string;
  similarity: number;
}

export function SearchCommandBar() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 300);

  const { data: searchResponse, isLoading } = trpc.search.search.useQuery(
    { query: debouncedQuery },
    { enabled: debouncedQuery.length >= 2 }
  );

  const results = searchResponse?.results ?? [];

  // Cmd+K handler
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const handleSelect = useCallback(
    (result: SearchResult) => {
      setOpen(false);
      setQuery("");

      // Navigate to the source item
      switch (result.sourceType) {
        case "INBOX_ITEM":
          router.push(`/inbox/${result.sourceId}`);
          break;
        case "NOTE":
          router.push(`/notes/${result.sourceId}`);
          break;
        case "ACTION":
          router.push(`/actions/${result.sourceId}`);
          break;
        case "RESOURCE":
          router.push(`/resources/${result.sourceId}`);
          break;
        case "CONVERSATION":
          router.push(`/conversations/${result.sourceId}`);
          break;
      }
    },
    [router]
  );

  // Group results by type
  const groupedResults = results?.reduce(
    (acc, result) => {
      const type = result.sourceType;
      if (!acc[type]) acc[type] = [];
      acc[type].push(result);
      return acc;
    },
    {} as Record<SearchSourceType, SearchResult[]>
  );

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="Search everything..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        {isLoading && (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
          </div>
        )}

        {!isLoading && query.length >= 2 && (!results || results.length === 0) && (
          <CommandEmpty>No results found.</CommandEmpty>
        )}

        {!isLoading && groupedResults && Object.keys(groupedResults).length > 0 && (
          <>
            {Object.entries(groupedResults).map(([type, typeResults]) => {
              const Icon = SOURCE_TYPE_ICONS[type as SearchSourceType];
              return (
                <CommandGroup
                  key={type}
                  heading={SOURCE_TYPE_LABELS[type as SearchSourceType] + "s"}
                >
                  {typeResults.map((result) => (
                    <CommandItem
                      key={result.id}
                      value={result.id}
                      onSelect={() => handleSelect(result)}
                      className="flex flex-col items-start gap-1 py-3"
                    >
                      <div className="flex items-center gap-2 w-full">
                        <Icon className="h-4 w-4 text-gray-400 shrink-0" />
                        <span className="font-medium truncate">
                          {result.title || "Untitled"}
                        </span>
                        <span className="ml-auto text-xs text-gray-400">
                          {Math.round(result.similarity * 100)}%
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 line-clamp-2 pl-6">
                        {result.snippet}
                      </p>
                    </CommandItem>
                  ))}
                </CommandGroup>
              );
            })}
          </>
        )}

        {query.length < 2 && (
          <>
            <CommandGroup heading="Quick Actions">
              <CommandItem onSelect={() => router.push("/capture")}>
                <Plus className="mr-2 h-4 w-4" />
                Capture new item
              </CommandItem>
              <CommandItem onSelect={() => router.push("/review")}>
                <Inbox className="mr-2 h-4 w-4" />
                Start daily review
              </CommandItem>
              <CommandItem onSelect={() => router.push("/search")}>
                <Search className="mr-2 h-4 w-4" />
                Advanced search
              </CommandItem>
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
