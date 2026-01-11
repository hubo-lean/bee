"use client";

import Image from "next/image";
import { formatDistanceToNow } from "date-fns";
import { FileText, ImageIcon, Mic, Mail, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface InboxItem {
  id: string;
  type: string;
  content: string;
  source: string;
  status: string;
  mediaUrl: string | null;
  createdAt: Date;
}

interface InboxCardProps {
  item: InboxItem;
  onClick: () => void;
}

const typeIcons: Record<string, typeof FileText> = {
  manual: FileText,
  image: ImageIcon,
  voice: Mic,
  email: Mail,
  forward: Mail,
};

const typeColors: Record<string, string> = {
  manual: "bg-blue-100 text-blue-600",
  image: "bg-purple-100 text-purple-600",
  voice: "bg-green-100 text-green-600",
  email: "bg-orange-100 text-orange-600",
  forward: "bg-orange-100 text-orange-600",
};

const statusConfig: Record<
  string,
  { color: string; label: string; animate?: boolean }
> = {
  pending: { color: "bg-gray-100 text-gray-600", label: "Pending" },
  processing: {
    color: "bg-blue-100 text-blue-600",
    label: "Processing",
    animate: true,
  },
  reviewed: { color: "bg-green-100 text-green-600", label: "Reviewed" },
  archived: { color: "bg-gray-100 text-gray-500", label: "Archived" },
};

export function InboxCard({ item, onClick }: InboxCardProps) {
  const TypeIcon = typeIcons[item.type] || FileText;
  const iconColor = typeColors[item.type] || "bg-gray-100 text-gray-600";
  const status = statusConfig[item.status] || statusConfig.pending;

  // Truncate content to ~100 characters
  const preview =
    item.content.length > 100
      ? item.content.slice(0, 100) + "..."
      : item.content;

  // Format the timestamp
  const timeAgo = formatDistanceToNow(new Date(item.createdAt), {
    addSuffix: true,
  });

  return (
    <button
      onClick={onClick}
      className="flex w-full items-start gap-3 border-b px-4 py-4 text-left transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary"
      aria-label={`${item.type} item: ${preview}`}
    >
      {/* Type Icon */}
      <div
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
          iconColor
        )}
      >
        <TypeIcon className="h-5 w-5" aria-hidden="true" />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="line-clamp-2 text-sm text-gray-900">{preview}</p>

          {/* Image thumbnail */}
          {item.type === "image" && item.mediaUrl && (
            <Image
              src={item.mediaUrl}
              alt="Thumbnail"
              width={48}
              height={48}
              className="h-12 w-12 shrink-0 rounded object-cover"
              unoptimized
            />
          )}
        </div>

        {/* Metadata row */}
        <div className="mt-2 flex items-center gap-2">
          <span className="text-xs text-gray-500">{timeAgo}</span>

          {item.type === "voice" && (
            <span className="flex items-center gap-1 text-xs text-gray-500">
              <Mic className="h-3 w-3" aria-hidden="true" />
              Voice
            </span>
          )}

          <Badge
            variant="secondary"
            className={cn("ml-auto text-xs", status.color)}
          >
            {status.animate && (
              <Loader2
                className="mr-1 h-3 w-3 animate-spin"
                aria-hidden="true"
              />
            )}
            {status.label}
          </Badge>
        </div>
      </div>
    </button>
  );
}
