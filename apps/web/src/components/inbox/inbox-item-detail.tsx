"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { formatDistanceToNow, format } from "date-fns";
import { X, FileText, ImageIcon, Mic, Mail, ZoomIn, ZoomOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AudioPlayer } from "./audio-player";

interface InboxItem {
  id: string;
  type: string;
  content: string;
  source: string;
  status: string;
  mediaUrl: string | null;
  createdAt: Date;
}

interface InboxItemDetailProps {
  item: InboxItem;
  onClose: () => void;
}

const typeIcons: Record<string, typeof FileText> = {
  manual: FileText,
  image: ImageIcon,
  voice: Mic,
  email: Mail,
  forward: Mail,
};

const typeLabels: Record<string, string> = {
  manual: "Text Note",
  image: "Image",
  voice: "Voice Recording",
  email: "Email",
  forward: "Forwarded Email",
};

const statusColors: Record<string, string> = {
  pending: "bg-gray-100 text-gray-600",
  processing: "bg-blue-100 text-blue-600",
  reviewed: "bg-green-100 text-green-600",
  archived: "bg-gray-100 text-gray-500",
};

export function InboxItemDetail({ item, onClose }: InboxItemDetailProps) {
  const [isZoomed, setIsZoomed] = useState(false);
  const TypeIcon = typeIcons[item.type] || FileText;

  // Close on escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Prevent body scroll when open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/50 transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        className={cn(
          "fixed z-50 flex flex-col bg-white shadow-xl transition-transform duration-300",
          // Desktop: slide from right
          "right-0 top-0 h-full w-full max-w-lg",
          // Mobile: could be bottom sheet, but keeping side panel for consistency
          "md:w-[480px]"
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby="detail-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <TypeIcon className="h-5 w-5 text-gray-500" aria-hidden="true" />
            <h2 id="detail-title" className="font-semibold text-gray-900">
              {typeLabels[item.type] || "Item"}
            </h2>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Close detail panel"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Image display */}
          {item.type === "image" && item.mediaUrl && (
            <div className="mb-4">
              <div
                className={cn(
                  "relative overflow-hidden rounded-lg bg-gray-100",
                  isZoomed ? "cursor-zoom-out" : "cursor-zoom-in"
                )}
                onClick={() => setIsZoomed(!isZoomed)}
              >
                <Image
                  src={item.mediaUrl}
                  alt="Captured image"
                  width={800}
                  height={600}
                  className={cn(
                    "w-full transition-transform duration-300",
                    isZoomed ? "scale-150" : "scale-100"
                  )}
                  unoptimized
                />
                <Button
                  variant="secondary"
                  size="icon"
                  className="absolute bottom-2 right-2"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsZoomed(!isZoomed);
                  }}
                  aria-label={isZoomed ? "Zoom out" : "Zoom in"}
                >
                  {isZoomed ? (
                    <ZoomOut className="h-4 w-4" />
                  ) : (
                    <ZoomIn className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Audio player for voice items */}
          {item.type === "voice" && item.mediaUrl && (
            <div className="mb-4">
              <AudioPlayer src={item.mediaUrl} />
            </div>
          )}

          {/* Full content */}
          <div className="prose prose-sm max-w-none">
            <div className="whitespace-pre-wrap text-gray-900">
              {item.content}
            </div>
          </div>
        </div>

        {/* Footer with metadata */}
        <div className="border-t bg-gray-50 px-4 py-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Badge
              variant="secondary"
              className={statusColors[item.status] || statusColors.pending}
            >
              {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
            </Badge>

            <span className="text-gray-500">
              Source: <span className="font-medium">{item.source}</span>
            </span>
          </div>

          <div className="mt-2 text-xs text-gray-500">
            <span title={format(new Date(item.createdAt), "PPpp")}>
              Captured{" "}
              {formatDistanceToNow(new Date(item.createdAt), {
                addSuffix: true,
              })}
            </span>
            <span className="mx-1">|</span>
            <span>{format(new Date(item.createdAt), "MMM d, yyyy h:mm a")}</span>
          </div>
        </div>
      </div>
    </>
  );
}
