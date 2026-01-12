import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { UnifiedSidebar } from "@/components/navigation/unified-sidebar";
import { MobileNav } from "@/components/navigation/mobile-nav";
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
      <div className="min-h-screen bg-background">
        {/* Desktop Sidebar - visible on lg and up (1024px+) */}
        <UnifiedSidebar user={session.user} className="hidden lg:flex" />

        {/* Main Content */}
        <main className="pb-14 lg:pb-0 lg:pl-[264px]">
          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
            {children}
          </div>
        </main>

        {/* Mobile Navigation (Bottom Nav + Drawer) - visible below lg */}
        <MobileNav user={session.user} className="lg:hidden" />
      </div>
    </AuthLayoutClient>
  );
}
