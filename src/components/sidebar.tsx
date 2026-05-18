"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useAuthStore } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Target,
  LayoutDashboard,
  ClipboardList,
  TrendingUp,
  Users,
  CheckSquare,
  Settings,
  BarChart3,
  FileText,
  Shield,
  LogOut,
  Calendar,
  AlertTriangle,
  Crosshair,
} from "lucide-react";

const navItems = {
  employee: [
    { href: "/employee", label: "Dashboard", icon: LayoutDashboard },
    { href: "/employee/goals", label: "My Goals", icon: Target },
    { href: "/employee/achievements", label: "Achievements", icon: TrendingUp },
  ],
  manager: [
    { href: "/manager", label: "Dashboard", icon: LayoutDashboard },
    { href: "/manager/team", label: "Team Goals", icon: Users },
    { href: "/manager/approvals", label: "Approvals", icon: CheckSquare },
    { href: "/manager/shared-goals", label: "Shared Goals", icon: Crosshair },
    { href: "/manager/checkins", label: "Check-ins", icon: ClipboardList },
    { href: "/manager/goals", label: "My Goals", icon: Target },
    { href: "/manager/achievements", label: "My Achievements", icon: TrendingUp },
  ],
  admin: [
    { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
    { href: "/admin/goals", label: "My Goals", icon: Target },
    { href: "/admin/approvals", label: "Approvals", icon: CheckSquare },
    { href: "/admin/cycles", label: "Cycles", icon: Calendar },
    { href: "/admin/thrust-areas", label: "Thrust Areas", icon: Crosshair },
    { href: "/admin/users", label: "Users", icon: Users },
    { href: "/admin/shared-goals", label: "Shared Goals", icon: Crosshair },
    { href: "/admin/reports", label: "Reports", icon: FileText },
    { href: "/admin/audit-log", label: "Audit Log", icon: Shield },
    { href: "/admin/analytics", label: "Analytics", icon: BarChart3 },
    { href: "/admin/escalations", label: "Escalations", icon: AlertTriangle },
    { href: "/admin/settings", label: "Settings", icon: Settings },
  ],
};

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout: clearAuth } = useAuthStore();

  const role = user?.role || "employee";
  const items = navItems[role] || navItems.employee;

  async function handleLogout() {
    try {
      await signOut(auth);
      await fetch("/api/auth/logout", { method: "POST" });
      clearAuth();
      router.push("/login");
    } catch {
      // silently handle logout errors
    }
  }

  const initials = user?.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "?";

  return (
    <div className="flex h-full w-64 flex-col border-r bg-sidebar">
      <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-4 bg-gradient-to-r from-primary/5 to-transparent">
        <Image
          src="/atomberg-logo.svg"
          alt="Atomberg"
          width={36}
          height={36}
          className="rounded-lg shadow-sm"
        />
        <div>
          <h2 className="font-semibold text-sm tracking-tight">GoalTracker</h2>
          <p className="text-[11px] text-muted-foreground font-medium">Atomberg</p>
        </div>
      </div>

      <ScrollArea className="flex-1 px-3 py-4">
        <nav className="space-y-1">
          {items.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== `/${role}` && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all duration-150",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm font-medium"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground hover:translate-x-0.5"
                )}
              >
                <div className={cn(
                  "flex items-center justify-center h-7 w-7 rounded-md transition-colors",
                  isActive ? "bg-primary-foreground/15" : "bg-transparent"
                )}>
                  <item.icon className="h-4 w-4" />
                </div>
                {item.label}
              </Link>
            );
          })}
        </nav>
      </ScrollArea>

      <div className="border-t border-sidebar-border p-4">
        <div className="flex items-center gap-3 mb-3">
          <Avatar className="h-9 w-9 ring-2 ring-primary/10">
            <AvatarFallback className="text-xs bg-primary/10 text-primary font-semibold">{initials}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user?.name}</p>
            <Badge variant="secondary" className="text-[10px] capitalize">
              {user?.role}
            </Badge>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </Button>
      </div>
    </div>
  );
}
