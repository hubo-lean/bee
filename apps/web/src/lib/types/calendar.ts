export interface Attendee {
  email: string;
  name?: string;
  status: "accepted" | "declined" | "tentative" | "needsAction";
}

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string | null;
  location?: string | null;
  startTime: Date;
  endTime: Date;
  isAllDay: boolean;
  status: string;
  attendees?: Attendee[] | null;
}
