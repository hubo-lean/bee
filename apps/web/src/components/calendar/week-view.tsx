"use client";

import { useMemo } from "react";
import { eachDayOfInterval, format, isSameDay, isToday } from "date-fns";
import { cn } from "@/lib/utils";
import { EventBlock } from "./event-block";
import type { CalendarEvent } from "@/lib/types/calendar";

interface WeekViewProps {
  events: CalendarEvent[];
  dateRange: { start: Date; end: Date };
  onEventClick: (event: CalendarEvent) => void;
}

export function WeekView({ events, dateRange, onEventClick }: WeekViewProps) {
  const days = eachDayOfInterval(dateRange);
  const hours = Array.from({ length: 12 }, (_, i) => i + 8); // 8am - 7pm

  // Group events by day
  const eventsByDay = useMemo(() => {
    return days.reduce((acc, day) => {
      const dayKey = format(day, "yyyy-MM-dd");
      acc[dayKey] = events.filter((e) =>
        isSameDay(new Date(e.startTime), day)
      );
      return acc;
    }, {} as Record<string, CalendarEvent[]>);
  }, [events, days]);

  // All-day events
  const allDayEvents = useMemo(() => {
    return events.filter((e) => e.isAllDay);
  }, [events]);

  return (
    <div className="flex flex-col h-full">
      {/* All-day events row */}
      {allDayEvents.length > 0 && (
        <div className="grid grid-cols-[60px_repeat(5,1fr)] gap-px bg-gray-200 mb-2">
          <div className="bg-white text-xs text-gray-500 py-1 pr-2 text-right">
            All day
          </div>
          {days.map((day) => {
            const dayAllDay = allDayEvents.filter((e) =>
              isSameDay(new Date(e.startTime), day)
            );
            return (
              <div key={day.toISOString()} className="bg-white p-1 min-h-[32px]">
                {dayAllDay.map((event) => (
                  <button
                    key={event.id}
                    onClick={() => onEventClick(event)}
                    className="w-full text-left text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded truncate hover:bg-blue-200"
                  >
                    {event.title}
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {/* Time grid */}
      <div className="flex-1 overflow-auto">
        <div className="grid grid-cols-[60px_repeat(5,1fr)] gap-px bg-gray-200 min-h-full">
          {/* Time column */}
          <div className="bg-white">
            <div className="h-12" /> {/* Header spacer */}
            {hours.map((hour) => (
              <div key={hour} className="h-16 text-xs text-gray-500 text-right pr-2 pt-1">
                {format(new Date().setHours(hour, 0), "h a")}
              </div>
            ))}
          </div>

          {/* Day columns (weekdays only) */}
          {days.slice(0, 5).map((day) => (
            <div key={day.toISOString()} className="bg-white">
              {/* Day header */}
              <div
                className={cn(
                  "h-12 flex flex-col items-center justify-center border-b sticky top-0 bg-white z-10",
                  isToday(day) && "bg-blue-50"
                )}
              >
                <span className="text-xs text-gray-500">{format(day, "EEE")}</span>
                <span
                  className={cn(
                    "text-lg font-semibold",
                    isToday(day) && "text-blue-600"
                  )}
                >
                  {format(day, "d")}
                </span>
              </div>

              {/* Events container */}
              <div className="relative">
                {/* Hour grid lines */}
                {hours.map((hour) => (
                  <div key={hour} className="h-16 border-b border-gray-100" />
                ))}

                {/* Position events */}
                {eventsByDay[format(day, "yyyy-MM-dd")]
                  ?.filter((e) => !e.isAllDay)
                  .map((event) => (
                    <EventBlock
                      key={event.id}
                      event={event}
                      onClick={() => onEventClick(event)}
                    />
                  ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
