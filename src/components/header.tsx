"use client";

import { useState, useEffect } from "react";
import { useAuthStore } from "@/hooks/use-auth";
import { Badge } from "@/components/ui/badge";
import { getCurrentQuarter } from "@/lib/utils/date-utils";
import { NotificationBell } from "@/components/notification-bell";

export function Header({ title }: { title: string }) {
  const { user } = useAuthStore();
  const [quarter, setQuarter] = useState<string>("");

  useEffect(() => {
    setQuarter(getCurrentQuarter());
  }, []);

  return (
    <header className="relative flex items-center justify-between border-b bg-card px-6 py-4">
      <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-primary/60 via-primary/20 to-transparent" />
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground">
          Welcome back, <span className="font-medium text-foreground/80">{user?.name?.split(" ")[0]}</span>
        </p>
      </div>
      <div className="flex items-center gap-3">
        {quarter && (
          <Badge variant="outline" className="border-primary/30 text-primary font-medium">
            {quarter}
          </Badge>
        )}
        {user?.department && (
          <Badge variant="secondary">{user.department}</Badge>
        )}
        <NotificationBell />
      </div>
    </header>
  );
}
