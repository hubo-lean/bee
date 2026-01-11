"use client";

import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";

interface SignOutButtonProps {
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  className?: string;
}

export function SignOutButton({ variant = "outline", className }: SignOutButtonProps) {
  return (
    <Button
      variant={variant}
      className={className}
      onClick={() => signOut({ callbackUrl: "/login" })}
    >
      Sign out
    </Button>
  );
}
