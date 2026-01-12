import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function FullscreenLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  // Full-screen layout - no sidebar or bottom nav
  return (
    <div className="min-h-screen bg-background">
      {children}
    </div>
  );
}
