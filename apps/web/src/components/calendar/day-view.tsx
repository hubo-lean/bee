"use client";

import { useMemo } from "react";
import { format, isSameDay, isToday } from "date-fns";
import { cn } from "@/lib/utils";
import { EventBlock } from "./event-block";
import type { CalendarEvent } from "@/lib/types/calendar";

interface DayViewProps {
  events: CalendarEvent[];
  date: Date;
  onEventClick: (event: CalendarEvent) => void;
}

export function DayView({ events, date, onEventClick }: DayViewProps) {
  const hours = Array.from({ length: 14 }, (_, i) => i + 7); // 7am - 8pm

  // Filter events for this day
  const dayEvents = useMemo(() => {
    return events.filter((e) => isSameDay(new Date(e.startTime), date));
  }, [events, date]);

  const timedEvents = dayEvents.filter((e) => !e.isAllDay);
  const allDayEvents = dayEvents.filter((e) => e.isAllDay);

  return (
    <div className="flex flex-col h-full">
      {/* Day header */}
      <div
        className={cn(
          "flex items-center justify-center py-4 border-b",
          isToday(date) && "bg-blue-50"
        )}
      >
        <div className="text-center">
          <span className="text-sm text-gray-500 block">{format(date, "EEEE")}</span>
          <span
            className={cn(
              "text-3xl font-bold",
              isToday(date) && "text-blue-600"
            )}
          >
            {format(date, "d")}
          </span>
          <span className="text-sm text-gray-500 block">{format(date, "MMMM yyyy")}</span>
        </div>
      </div>

      {/* All-day events */}
      {allDayEvents.length > 0 && (
        <div className="border-b p-2 space-y-1">
          <span className="text-xs text-gray-500">All day</span>
          {allDayEvents.map((event) => (
            <button
              key={event.id}
              onClick={() => onEventClick(event)}
              className="w-full text-left text-sm bg-blue-100 text-blue-800 px-3 py-1.5 rounded hover:bg-blue-200"
            >
              {event.title}
            </button>
          ))}
        </div>
      )}

      {/* Time grid */}
      <div className="flex-1 overflow-auto">
        <div className="grid grid-cols-[60px_1fr] min-h-full">
          {/* Time column */}
          <div className="bg-white">
            {hours.map((hour) => (
              <div key={hour} className="h-16 text-xs text-gray-500 text-right pr-2 pt-1">
                {format(new Date().setHours(hour, 0), "h a")}
              </div>
            ))}
          </div>

          {/* Events column */}
          <div className="relative border-l">
            {/* Hour grid lines */}
            {hours.map((hour) => (
              <div key={hour} className="h-16 border-b border-gray-100" />
            ))}

            {/* Position events */}
            {timedEvents.map((event) => (
              <EventBlock
                key={event.id}
                event={event}
                onClick={() => onEventClick(event)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
