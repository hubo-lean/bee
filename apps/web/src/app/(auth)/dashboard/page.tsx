import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Inbox, Calendar, CheckCircle } from "lucide-react";

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const firstName = session.user.name?.split(" ")[0] || "there";

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome back, {firstName}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Here&apos;s what&apos;s on your plate today
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Inbox Items</CardTitle>
            <Inbox className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">items to process</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today&apos;s Actions</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">tasks due today</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Meetings Today</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">scheduled meetings</p>
          </CardContent>
        </Card>
      </div>

      {/* Today's Priorities */}
      <Card>
        <CardHeader>
          <CardTitle>Today&apos;s Priorities</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <CheckCircle className="h-12 w-12 text-gray-300" aria-hidden="true" />
            <p className="mt-4 text-sm text-gray-500">
              No priorities set for today
            </p>
            <p className="mt-1 text-xs text-gray-400">
              Your top tasks will appear here
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
