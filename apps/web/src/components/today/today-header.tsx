"use client";

import { format } from "date-fns";

export function TodayHeader() {
  const today = new Date();

  return (
    <div className="flex items-center justify-between mb-6">
      <h1 className="text-2xl font-bold">Today</h1>
      <p className="text-sm text-muted-foreground">
        {format(today, "EEEE, MMMM d")}
      </p>
    </div>
  );
}
