import { Metadata } from "next";
import { TodayView } from "@/components/today/today-view";
import { TodayHeader } from "@/components/today/today-header";

export const metadata: Metadata = {
  title: "Today | Bee",
  description: "Your actions for today",
};

export default function TodayPage() {
  return (
    <div className="container max-w-3xl py-6">
      <TodayHeader />
      <TodayView />
    </div>
  );
}
