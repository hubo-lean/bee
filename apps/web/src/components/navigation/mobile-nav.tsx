"use client";

import { BottomNav } from "./bottom-nav";
import { MobileDrawer } from "./mobile-drawer";
import { useMobileNav } from "./mobile-nav-provider";

interface MobileNavProps {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
  className?: string;
}

export function MobileNav({ user, className }: MobileNavProps) {
  const { isDrawerOpen, openDrawer, closeDrawer } = useMobileNav();

  return (
    <>
      <BottomNav onMenuClick={openDrawer} className={className} />
      <MobileDrawer isOpen={isDrawerOpen} onClose={closeDrawer} user={user} />
    </>
  );
}
