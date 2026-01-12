"use client";

import Link from "next/link";
import { format } from "date-fns";
import { Calendar, AlertTriangle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

interface CalendarSummaryCardProps {
  weekStart: Date;
}

export function CalendarSummaryCard({ weekStart }: CalendarSummaryCardProps) {
  const { data: summary, isLoading } = trpc.calendar.getSummary.useQuery({
    weekStart,
  });

  if (isLoading) {
    return <CalendarSummarySkeleton />;
  }

  if (!summary) {
    return (
      <Card>
        <CardContent className="py-6 text-center">
          <Calendar className="h-10 w-10 mx-auto mb-2 text-gray-300" />
          <p className="text-sm text-gray-500">
            Connect your calendar to see your schedule
          </p>
          <Button variant="link" size="sm" asChild>
            <Link href="/settings">Connect</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      className={cn(summary.isOverloaded && "border-orange-300 bg-orange-50")}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            This Week&apos;s Calendar
          </CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/calendar">View</Link>
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Overload Warning */}
        {summary.isOverloaded && (
          <Alert className="bg-orange-100 border-orange-300">
            <AlertTriangle className="h-4 w-4 text-orange-600" />
            <AlertDescription className="text-orange-800">
              Heavy meeting week! {summary.totalMeetingHours.toFixed(0)}+ hours
              of meetings
            </AlertDescription>
          </Alert>
        )}

        {/* Main Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">
              {summary.totalMeetingHours.toFixed(1)}h
            </div>
            <div className="text-sm text-gray-500">Meetings</div>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-green-600">
              {summary.totalFocusHours.toFixed(1)}h
            </div>
            <div className="text-sm text-gray-500">Focus Time</div>
          </div>
        </div>

        {/* Meeting Percentage Bar */}
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-500">Time allocation</span>
            <span className="text-gray-500">
              {summary.meetingPercentage.toFixed(0)}% meetings
            </span>
          </div>
          <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full transition-all",
                summary.meetingPercentage > 75
                  ? "bg-red-500"
                  : summary.meetingPercentage > 50
                    ? "bg-orange-500"
                    : "bg-blue-500"
              )}
              style={{
                width: `${Math.min(summary.meetingPercentage, 100)}%`,
              }}
            />
          </div>
        </div>

        {/* Daily Breakdown */}
        <div>
          <p className="text-sm font-medium mb-2">Daily breakdown</p>
          <div className="flex gap-1">
            {summary.dailyMeetingHours.map((day) => (
              <div
                key={day.date.toISOString()}
                className="flex-1 flex flex-col items-center"
              >
                <div
                  className={cn(
                    "w-full rounded-t",
                    day.isOverloaded ? "bg-orange-400" : "bg-blue-400"
                  )}
                  style={{ height: `${Math.max(day.hours * 8, 4)}px` }}
                />
                <span className="text-xs text-gray-500 mt-1">
                  {format(day.date, "EEE")}
                </span>
                <span className="text-xs font-medium">
                  {day.hours.toFixed(1)}h
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Key Insights */}
        <div className="text-sm space-y-1">
          <div className="flex justify-between">
            <span className="text-gray-500">Busiest day</span>
            <span className="font-medium">
              {format(summary.busiestDay.date, "EEEE")} (
              {summary.busiestDay.hours.toFixed(1)}h)
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Best focus day</span>
            <span className="font-medium">
              {format(summary.lightestDay.date, "EEEE")} (
              {summary.lightestDay.hours.toFixed(1)}h)
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Total meetings</span>
            <span className="font-medium">{summary.eventCount}</span>
          </div>
          {summary.hasBackToBack && (
            <div className="flex items-center gap-1 text-orange-600">
              <AlertCircle className="h-4 w-4" />
              <span>Back-to-back meetings detected</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function CalendarSummarySkeleton() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-8 w-16" />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-20 rounded-lg" />
          <Skeleton className="h-20 rounded-lg" />
        </div>
        <Skeleton className="h-3 rounded-full" />
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <Skeleton className="w-full h-12" />
              <Skeleton className="h-3 w-8" />
            </div>
          ))}
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-24" />
        </div>
      </CardContent>
    </Card>
  );
}
