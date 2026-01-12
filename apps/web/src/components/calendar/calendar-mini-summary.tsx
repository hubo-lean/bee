"use client";

import Link from "next/link";
import { startOfWeek } from "date-fns";
import { Calendar, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

export function CalendarMiniSummary() {
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const { data: summary } = trpc.calendar.getSummary.useQuery({ weekStart });

  if (!summary) return null;

  return (
    <Card>
      <CardContent className="py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "p-2 rounded-full",
                summary.isOverloaded ? "bg-orange-100" : "bg-blue-100"
              )}
            >
              <Calendar
                className={cn(
                  "h-5 w-5",
                  summary.isOverloaded ? "text-orange-600" : "text-blue-600"
                )}
              />
            </div>
            <div>
              <p className="font-medium">
                {summary.totalMeetingHours.toFixed(0)}h meetings this week
              </p>
              <p className="text-sm text-gray-500">
                {summary.totalFocusHours.toFixed(0)}h focus time available
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/calendar">
              <ChevronRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
