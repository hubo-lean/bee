"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  startOfWeek,
  endOfWeek,
  startOfDay,
  endOfDay,
  addWeeks,
  format,
} from "date-fns";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { WeekView } from "@/components/calendar/week-view";
import { DayView } from "@/components/calendar/day-view";
import { EventDetailSheet } from "@/components/calendar/event-detail-sheet";
import { CalendarSkeleton } from "@/components/calendar/calendar-skeleton";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import type { CalendarEvent } from "@/lib/types/calendar";

export default function CalendarPage() {
  const [view, setView] = useState<"week" | "day">("week");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  const dateRange = useMemo(() => {
    if (view === "week") {
      return {
        start: startOfWeek(selectedDate, { weekStartsOn: 1 }),
        end: endOfWeek(selectedDate, { weekStartsOn: 1 }),
      };
    }
    return {
      start: startOfDay(selectedDate),
      end: endOfDay(selectedDate),
    };
  }, [view, selectedDate]);

  const { data: account, isLoading: accountLoading } = trpc.calendar.getDefaultAccount.useQuery();
  const { data: events, isLoading: eventsLoading, refetch } = trpc.calendar.getEvents.useQuery(
    { dateRange },
    { enabled: !!account }
  );

  const syncMutation = trpc.calendar.syncCalendar.useMutation({
    onSuccess: () => {
      refetch();
    },
  });

  const handleSync = async () => {
    if (account?.id) {
      await syncMutation.mutateAsync({ accountId: account.id });
    }
  };

  const handlePrevious = () => {
    if (view === "week") {
      setSelectedDate(addWeeks(selectedDate, -1));
    } else {
      setSelectedDate(new Date(selectedDate.getTime() - 24 * 60 * 60 * 1000));
    }
  };

  const handleNext = () => {
    if (view === "week") {
      setSelectedDate(addWeeks(selectedDate, 1));
    } else {
      setSelectedDate(new Date(selectedDate.getTime() + 24 * 60 * 60 * 1000));
    }
  };

  const handleToday = () => {
    setSelectedDate(new Date());
  };

  const isLoading = accountLoading || eventsLoading;

  // No account state
  if (!accountLoading && !account) {
    return (
      <div className="h-full flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <div className="flex h-16 w-16 mx-auto items-center justify-center rounded-full bg-gray-100">
              <Calendar className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="font-semibold mt-4 mb-2">Connect Your Calendar</h3>
            <p className="text-sm text-gray-500 mb-4">
              Link your calendar to see events and schedule time blocks.
            </p>
            <Button asChild>
              <Link href="/settings">Connect Calendar</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <h1 className="text-2xl font-bold">Calendar</h1>
        <div className="flex items-center gap-2">
          {/* View Toggle */}
          <div className="flex rounded-lg border">
            <button
              onClick={() => setView("week")}
              className={cn(
                "px-3 py-1.5 text-sm font-medium rounded-l-lg transition-colors",
                view === "week"
                  ? "bg-gray-900 text-white"
                  : "text-gray-600 hover:bg-gray-100"
              )}
            >
              Week
            </button>
            <button
              onClick={() => setView("day")}
              className={cn(
                "px-3 py-1.5 text-sm font-medium rounded-r-lg transition-colors",
                view === "day"
                  ? "bg-gray-900 text-white"
                  : "text-gray-600 hover:bg-gray-100"
              )}
            >
              Day
            </button>
          </div>

          {/* Sync Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleSync}
            disabled={syncMutation.isPending}
          >
            <RefreshCw
              className={cn(
                "h-4 w-4 mr-1",
                syncMutation.isPending && "animate-spin"
              )}
            />
            Sync
          </Button>
        </div>
      </div>

      {/* Date Navigation */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={handlePrevious}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={handleNext}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={handleToday}>
            Today
          </Button>
        </div>
        <h2 className="font-semibold">
          {view === "week"
            ? `${format(dateRange.start, "MMM d")} - ${format(dateRange.end, "MMM d, yyyy")}`
            : format(selectedDate, "MMMM d, yyyy")}
        </h2>
        <div className="w-[120px]" /> {/* Spacer for centering */}
      </div>

      {/* Calendar Grid */}
      <div className="flex-1 overflow-auto p-4">
        {isLoading ? (
          <CalendarSkeleton view={view} />
        ) : view === "week" ? (
          <WeekView
            events={(events as CalendarEvent[]) || []}
            dateRange={dateRange}
            onEventClick={setSelectedEvent}
          />
        ) : (
          <DayView
            events={(events as CalendarEvent[]) || []}
            date={selectedDate}
            onEventClick={setSelectedEvent}
          />
        )}
      </div>

      {/* Event Detail Sheet */}
      <EventDetailSheet
        event={selectedEvent}
        open={!!selectedEvent}
        onClose={() => setSelectedEvent(null)}
      />
    </div>
  );
}
