"use client";

import Link from "next/link";
import { format } from "date-fns";
import {
  FileText,
  CheckSquare,
  Inbox,
  Link2,
  MessageSquare,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { SearchSourceType } from "@packages/db";

const SOURCE_TYPE_ICONS: Record<SearchSourceType, typeof Inbox> = {
  INBOX_ITEM: Inbox,
  NOTE: FileText,
  ACTION: CheckSquare,
  RESOURCE: Link2,
  CONVERSATION: MessageSquare,
};

const SOURCE_TYPE_LABELS: Record<SearchSourceType, string> = {
  INBOX_ITEM: "Inbox",
  NOTE: "Note",
  ACTION: "Action",
  RESOURCE: "Resource",
  CONVERSATION: "Conversation",
};

const SOURCE_TYPE_COLORS: Record<SearchSourceType, string> = {
  INBOX_ITEM: "bg-purple-100 text-purple-700",
  NOTE: "bg-blue-100 text-blue-700",
  ACTION: "bg-green-100 text-green-700",
  RESOURCE: "bg-orange-100 text-orange-700",
  CONVERSATION: "bg-pink-100 text-pink-700",
};

interface SearchResultCardProps {
  result: {
    id: string;
    sourceType: SearchSourceType;
    sourceId: string;
    title: string | null;
    snippet: string;
    similarity: number;
    tags: string[];
    createdAt: Date;
  };
  query: string;
}

function getSourceUrl(sourceType: SearchSourceType, sourceId: string): string {
  switch (sourceType) {
    case "INBOX_ITEM":
      return `/inbox/${sourceId}`;
    case "NOTE":
      return `/notes/${sourceId}`;
    case "ACTION":
      return `/actions/${sourceId}`;
    case "RESOURCE":
      return `/resources/${sourceId}`;
    case "CONVERSATION":
      return `/conversations/${sourceId}`;
    default:
      return "#";
  }
}

function highlightQuery(text: string, query: string): string {
  if (!query) return text;

  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  let result = text;

  for (const word of words) {
    const regex = new RegExp(`(${word})`, "gi");
    result = result.replace(regex, '<mark class="bg-yellow-200 rounded">$1</mark>');
  }

  return result;
}

export function SearchResultCard({ result, query }: SearchResultCardProps) {
  const Icon = SOURCE_TYPE_ICONS[result.sourceType];
  const typeLabel = SOURCE_TYPE_LABELS[result.sourceType];
  const typeColor = SOURCE_TYPE_COLORS[result.sourceType];
  const url = getSourceUrl(result.sourceType, result.sourceId);

  return (
    <Link href={url}>
      <Card className="hover:border-blue-300 hover:shadow-sm transition-all cursor-pointer">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-gray-100 rounded-lg shrink-0">
              <Icon className="h-5 w-5 text-gray-600" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="secondary" className={typeColor}>
                  {typeLabel}
                </Badge>
                <span className="text-xs text-gray-400">
                  {Math.round(result.similarity * 100)}% match
                </span>
                <span className="text-xs text-gray-400 ml-auto">
                  {format(new Date(result.createdAt), "MMM d, yyyy")}
                </span>
              </div>

              <h3 className="font-medium text-gray-900 truncate">
                {result.title || "Untitled"}
              </h3>

              <p
                className="text-sm text-gray-600 mt-1 line-clamp-2"
                dangerouslySetInnerHTML={{
                  __html: highlightQuery(result.snippet, query),
                }}
              />

              {result.tags.length > 0 && (
                <div className="flex gap-1 mt-2 flex-wrap">
                  {result.tags.slice(0, 5).map((tag) => (
                    <Badge key={tag} variant="outline" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                  {result.tags.length > 5 && (
                    <Badge variant="outline" className="text-xs">
                      +{result.tags.length - 5}
                    </Badge>
                  )}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
