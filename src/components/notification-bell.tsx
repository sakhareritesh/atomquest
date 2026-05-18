"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Bell, Check, CheckCheck, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Notification } from "@/types";

const POLL_INTERVAL = 30000;

const TYPE_COLORS: Record<string, string> = {
  escalation_reminder: "bg-red-500",
  team_escalation: "bg-amber-500",
  admin_escalation_alert: "bg-blue-500",
};

export function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const router = useRouter();

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications?limit=15");
      if (!res.ok) return;
      const data = await res.json();
      setNotifications(data.notifications || []);
      setUnreadCount(data.unread_count || 0);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    intervalRef.current = setInterval(() => {
      if (document.visibilityState === "visible") fetchNotifications();
    }, POLL_INTERVAL);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchNotifications]);

  async function markAsRead(notifId: string) {
    try {
      await fetch("/api/notifications", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notification_id: notifId }),
      });
      setNotifications((prev) =>
        prev.map((n) => (n.id === notifId ? { ...n, is_read: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch {
      /* ignore */
    }
  }

  async function markAllRead() {
    try {
      await fetch("/api/notifications", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mark_all_read: true }),
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch {
      /* ignore */
    }
  }

  function handleClick(notif: Notification) {
    if (!notif.is_read) markAsRead(notif.id);
    if (notif.link) {
      setOpen(false);
      router.push(notif.link);
    }
  }

  function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button className="relative p-2 rounded-md hover:bg-accent transition-colors">
            <Bell className="h-5 w-5 text-muted-foreground" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </button>
        }
      />
      <PopoverContent align="end" className="w-96 p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h3 className="text-sm font-semibold">Notifications</h3>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={markAllRead}>
              <CheckCheck className="h-3.5 w-3.5 mr-1" />
              Mark all read
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-80">
          {notifications.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              <Bell className="h-8 w-8 mx-auto mb-2 opacity-30" />
              No notifications yet
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notif) => (
                <button
                  key={notif.id}
                  onClick={() => handleClick(notif)}
                  className={`w-full text-left px-4 py-3 hover:bg-accent/50 transition-colors ${
                    !notif.is_read ? "bg-accent/20" : ""
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-1.5 flex-shrink-0">
                      <div
                        className={`h-2 w-2 rounded-full ${
                          notif.is_read
                            ? "bg-transparent"
                            : TYPE_COLORS[notif.type] || "bg-blue-500"
                        }`}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${!notif.is_read ? "font-semibold" : "font-medium"}`}>
                        {notif.title}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        {notif.message}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[11px] text-muted-foreground">
                          {timeAgo(notif.created_at)}
                        </span>
                        {notif.link && (
                          <ExternalLink className="h-3 w-3 text-muted-foreground" />
                        )}
                      </div>
                    </div>
                    {!notif.is_read && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          markAsRead(notif.id);
                        }}
                        className="mt-1 p-1 rounded hover:bg-accent"
                        title="Mark as read"
                      >
                        <Check className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
