import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/navigation/sidebar";
import { BottomNav } from "@/components/navigation/bottom-nav";
import { AuthLayoutClient } from "@/components/layout/auth-layout-client";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  return (
    <AuthLayoutClient>
      <div className="min-h-screen bg-gray-50">
        {/* Desktop Sidebar */}
        <Sidebar user={session.user} className="hidden md:flex" />

        {/* Main Content */}
        <main className="pb-20 md:pb-0 md:pl-64">
          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
            {children}
          </div>
        </main>

        {/* Mobile Bottom Nav */}
        <BottomNav className="md:hidden" />
      </div>
    </AuthLayoutClient>
  );
}
