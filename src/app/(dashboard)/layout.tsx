"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuthStore } from "@/hooks/use-auth";
import { Sidebar } from "@/components/sidebar";
import { Loader2 } from "lucide-react";

const VALID_ROLES = new Set(["employee", "manager", "admin"]);

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    if (loading) return;

    if (!user) {
      setAuthorized(false);
      router.push("/login");
      return;
    }

    if (!VALID_ROLES.has(user.role)) {
      setAuthorized(false);
      router.push("/login");
      return;
    }

    const allowedPrefix = `/${user.role}`;
    if (!pathname.startsWith(allowedPrefix)) {
      setAuthorized(false);
      router.push(allowedPrefix);
      return;
    }

    setAuthorized(true);
  }, [user, loading, router, pathname]);

  if (loading || !authorized) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-auto bg-muted/30">{children}</main>
    </div>
  );
}
