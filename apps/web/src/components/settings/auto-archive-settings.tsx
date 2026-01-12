"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";

export function AutoArchiveSettings() {
  const { data: settings } = trpc.user.getSettings.useQuery();
  const updateSettings = trpc.user.updateSettings.useMutation();

  const [days, setDays] = useState<number | null>(null);

  // Initialize state when data loads
  useEffect(() => {
    if (settings && days === null) {
      setDays(settings.autoArchiveDays ?? 30);
    }
  }, [settings, days]);

  const handleChange = (value: string) => {
    const newDays = parseInt(value);
    setDays(newDays);
    updateSettings.mutate({ autoArchiveDays: newDays });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Auto-Archive</CardTitle>
        <CardDescription>
          Automatically archive unprocessed items after a certain period.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4">
          <Label htmlFor="autoArchiveDays">Archive after</Label>
          <Select value={(days ?? 30).toString()} onValueChange={handleChange}>
            <SelectTrigger className="w-32" id="autoArchiveDays">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7 days</SelectItem>
              <SelectItem value="15">15 days</SelectItem>
              <SelectItem value="30">30 days</SelectItem>
              <SelectItem value="60">60 days</SelectItem>
              <SelectItem value="0">Never</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <p className="text-sm text-muted-foreground mt-2">
          Items will be tagged as &quot;Unprocessed&quot; and moved to Archive.
          They remain searchable.
        </p>
      </CardContent>
    </Card>
  );
}
