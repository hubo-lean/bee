"use client";

import { differenceInMinutes, format } from "date-fns";
import { cn } from "@/lib/utils";

interface CalendarEvent {
  id: string;
  title: string;
  startTime: Date;
  endTime: Date;
  status: string;
}

interface EventBlockProps {
  event: CalendarEvent;
  onClick: () => void;
}

export function EventBlock({ event, onClick }: EventBlockProps) {
  const startTime = new Date(event.startTime);
  const endTime = new Date(event.endTime);
  const startHour = startTime.getHours();
  const startMinute = startTime.getMinutes();
  const durationMinutes = differenceInMinutes(endTime, startTime);

  // Calculate position: 64px per hour, starting from 8am
  const top = (startHour - 8) * 64 + (startMinute / 60) * 64;
  const height = Math.max((durationMinutes / 60) * 64, 24);

  return (
    <button
      onClick={onClick}
      className={cn(
        "absolute left-1 right-1 rounded px-2 py-1 text-left overflow-hidden transition-colors",
        "bg-blue-100 border-l-4 border-blue-500 hover:bg-blue-200",
        event.status === "tentative" && "bg-yellow-100 border-yellow-500 hover:bg-yellow-200",
        event.status === "cancelled" && "bg-gray-100 border-gray-400 hover:bg-gray-200 line-through"
      )}
      style={{ top: `${top}px`, height: `${height}px` }}
    >
      <p className={cn(
        "text-xs font-medium truncate",
        event.status === "cancelled" ? "text-gray-500" : "text-blue-900"
      )}>
        {event.title}
      </p>
      {height > 32 && (
        <p className={cn(
          "text-xs",
          event.status === "cancelled" ? "text-gray-400" : "text-blue-700"
        )}>
          {format(startTime, "h:mm a")}
        </p>
      )}
    </button>
  );
}
