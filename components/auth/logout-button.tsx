"use client";

import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

export function LogoutButton({ className }: { className?: string }) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className={className}
      onClick={() => signOut({ redirectTo: "/login" })}
    >
      <LogOut className="w-4 h-4 mr-2" />
      Sign out
    </Button>
  );
}
