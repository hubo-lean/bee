"use client";

import { useState } from "react";
import { format, startOfDay, addDays } from "date-fns";
import { CalendarPlus, Loader2, AlertTriangle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

interface TimeBlockModalProps {
  action: {
    id: string;
    description: string;
  };
  open: boolean;
  onClose: () => void;
  onCreated: (eventId: string) => void;
}

const DURATION_OPTIONS = [
  { value: 30, label: "30m" },
  { value: 60, label: "1h" },
  { value: 120, label: "2h" },
];

export function TimeBlockModal({
  action,
  open,
  onClose,
  onCreated,
}: TimeBlockModalProps) {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [duration, setDuration] = useState<number>(60);
  const [customDuration, setCustomDuration] = useState<string>("60");
  const [notes, setNotes] = useState("");

  const { data: freeSlots, isLoading: loadingSlots } =
    trpc.calendar.getFreeSlots.useQuery(
      {
        date: selectedDate,
        minDuration: duration,
      },
      {
        enabled: open,
      }
    );

  const createTimeBlock = trpc.calendar.createTimeBlock.useMutation({
    onSuccess: (result) => {
      onCreated(result.eventId);
      onClose();
    },
  });

  const handleCreate = () => {
    if (!selectedTime) return;

    const [hours, minutes] = selectedTime.split(":").map(Number);
    const startTime = new Date(selectedDate);
    startTime.setHours(hours, minutes, 0, 0);

    createTimeBlock.mutate({
      actionId: action.id,
      startTime,
      duration,
      notes: notes || undefined,
    });
  };

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      setSelectedDate(date);
      setSelectedTime(null);
    }
  };

  const handleDurationChange = (newDuration: number) => {
    setDuration(newDuration);
    setCustomDuration(String(newDuration));
    setSelectedTime(null);
  };

  const handleCustomDurationChange = (value: string) => {
    setCustomDuration(value);
    const parsed = parseInt(value, 10);
    if (!isNaN(parsed) && parsed >= 15 && parsed <= 480) {
      setDuration(parsed);
      setSelectedTime(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarPlus className="h-5 w-5" />
            Schedule Time Block
          </DialogTitle>
          <DialogDescription className="line-clamp-2">
            Block time for: {action.description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Date Picker */}
          <div>
            <Label>Date</Label>
            <div className="mt-2">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={handleDateSelect}
                disabled={(date) =>
                  date < startOfDay(new Date()) ||
                  date > addDays(new Date(), 30)
                }
                className="rounded-md border"
              />
            </div>
          </div>

          {/* Duration Selector */}
          <div>
            <Label>Duration</Label>
            <div className="flex gap-2 mt-2">
              {DURATION_OPTIONS.map((opt) => (
                <Button
                  key={opt.value}
                  variant={duration === opt.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleDurationChange(opt.value)}
                >
                  {opt.label}
                </Button>
              ))}
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={
                      !DURATION_OPTIONS.some((o) => o.value === duration)
                        ? "default"
                        : "outline"
                    }
                    size="sm"
                  >
                    <Clock className="h-3 w-3 mr-1" />
                    Custom
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-48">
                  <div className="space-y-2">
                    <Label>Minutes</Label>
                    <Input
                      type="number"
                      min={15}
                      max={480}
                      step={15}
                      value={customDuration}
                      onChange={(e) => handleCustomDurationChange(e.target.value)}
                    />
                    <p className="text-xs text-gray-500">15-480 minutes</p>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Available Time Slots */}
          <div>
            <Label>
              Available Times on {format(selectedDate, "EEE, MMM d")}
            </Label>
            {loadingSlots ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
              </div>
            ) : !freeSlots || freeSlots.length === 0 ? (
              <p className="text-sm text-gray-500 py-2">
                No free slots available for this duration on this day
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-2 mt-2 max-h-48 overflow-y-auto">
                {freeSlots.map((slot) => (
                  <Button
                    key={slot.start}
                    variant={selectedTime === slot.start ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedTime(slot.start)}
                    className={cn(
                      "text-xs",
                      slot.hasConflict && "border-orange-300 bg-orange-50"
                    )}
                  >
                    {slot.start}
                    {slot.hasConflict && (
                      <AlertTriangle className="h-3 w-3 ml-1 text-orange-500" />
                    )}
                  </Button>
                ))}
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <Label>Notes (optional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any notes for this time block..."
              rows={2}
              className="mt-2"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={!selectedTime || createTimeBlock.isPending}
          >
            {createTimeBlock.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <CalendarPlus className="h-4 w-4 mr-2" />
            )}
            Create Time Block
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
