"use client";

import { differenceInMinutes, format } from "date-fns";
import { Clock, MapPin, Users, FileText, Check, X, HelpCircle } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { Attendee, CalendarEvent } from "@/lib/types/calendar";

interface EventDetailSheetProps {
  event: CalendarEvent | null;
  open: boolean;
  onClose: () => void;
}

function AttendeeStatusIcon({ status }: { status: Attendee["status"] }) {
  switch (status) {
    case "accepted":
      return <Check className="h-4 w-4 text-green-600" />;
    case "declined":
      return <X className="h-4 w-4 text-red-600" />;
    case "tentative":
      return <HelpCircle className="h-4 w-4 text-yellow-600" />;
    default:
      return <HelpCircle className="h-4 w-4 text-gray-400" />;
  }
}

export function EventDetailSheet({ event, open, onClose }: EventDetailSheetProps) {
  if (!event) return null;

  const startTime = new Date(event.startTime);
  const endTime = new Date(event.endTime);
  const duration = differenceInMinutes(endTime, startTime);
  const attendees = event.attendees;

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{event.title}</SheetTitle>
        </SheetHeader>

        <div className="space-y-4 mt-6">
          {/* Time */}
          <div className="flex items-start gap-3">
            <Clock className="h-5 w-5 text-gray-400 mt-0.5" />
            <div>
              <p className="font-medium">
                {format(startTime, "EEEE, MMMM d")}
              </p>
              {event.isAllDay ? (
                <p className="text-sm text-gray-500">All day</p>
              ) : (
                <p className="text-sm text-gray-500">
                  {format(startTime, "h:mm a")} -{" "}
                  {format(endTime, "h:mm a")}
                  <span className="ml-2">({duration} minutes)</span>
                </p>
              )}
            </div>
          </div>

          {/* Location */}
          {event.location && (
            <div className="flex items-start gap-3">
              <MapPin className="h-5 w-5 text-gray-400 mt-0.5" />
              <p>{event.location}</p>
            </div>
          )}

          {/* Attendees */}
          {attendees && attendees.length > 0 && (
            <div className="flex items-start gap-3">
              <Users className="h-5 w-5 text-gray-400 mt-0.5" />
              <div>
                <p className="font-medium mb-2">
                  {attendees.length} attendee{attendees.length !== 1 && "s"}
                </p>
                <div className="space-y-1">
                  {attendees.map((attendee, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <AttendeeStatusIcon status={attendee.status} />
                      <span>{attendee.name || attendee.email}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Description */}
          {event.description && (
            <div className="flex items-start gap-3">
              <FileText className="h-5 w-5 text-gray-400 mt-0.5" />
              <div className="prose prose-sm max-w-none">
                <p className="text-sm text-gray-700 whitespace-pre-wrap">
                  {event.description}
                </p>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
