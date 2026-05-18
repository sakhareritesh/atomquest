"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Calendar, RefreshCw } from "lucide-react";
import { formatDate } from "@/lib/utils/date-utils";
import { toast } from "sonner";
import type { Cycle, QuarterlyWindow } from "@/types";

export default function CyclesPage() {
  const [cycles, setCycles] = useState<(Cycle & { quarterly_windows: QuarterlyWindow[] })[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    year: new Date().getFullYear(),
    goal_setting_start: "",
    goal_setting_end: "",
    q1_open: "",
    q1_close: "",
    q2_open: "",
    q2_close: "",
    q3_open: "",
    q3_close: "",
    q4_open: "",
    q4_close: "",
  });

  async function fetchCycles() {
    try {
      const res = await fetch("/api/cycles");
      if (!res.ok) {
        toast.error("Failed to load cycles");
        setLoading(false);
        return;
      }
      const data = await res.json();
      setCycles(data.cycles || []);
    } catch {
      toast.error("Failed to load cycles");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchCycles();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await fetch("/api/cycles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          year: form.year,
          goal_setting_start: form.goal_setting_start,
          goal_setting_end: form.goal_setting_end,
          windows: [
            { quarter: "Q1", window_open: form.q1_open, window_close: form.q1_close },
            { quarter: "Q2", window_open: form.q2_open, window_close: form.q2_close },
            { quarter: "Q3", window_open: form.q3_open, window_close: form.q3_close },
            { quarter: "Q4", window_open: form.q4_open, window_close: form.q4_close },
          ].filter((w) => w.window_open && w.window_close),
        }),
      });
      if (res.ok) {
        toast.success("Cycle created successfully");
        setOpen(false);
        fetchCycles();
      } else {
        const err = await res.json();
        toast.error(err.error);
      }
    } catch {
      toast.error("Failed to create cycle");
    }
  }

  function isWithinDateRange(windowOpen: string, windowClose: string): boolean {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const open = new Date(windowOpen);
    const close = new Date(windowClose);
    open.setHours(0, 0, 0, 0);
    close.setHours(23, 59, 59, 999);
    return today >= open && today <= close;
  }

  const [syncing, setSyncing] = useState(false);

  async function handleSync() {
    setSyncing(true);
    try {
      const res = await fetch("/api/sync-windows", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message);
        fetchCycles();
      } else {
        toast.error(data.error || "Sync failed");
      }
    } catch {
      toast.error("Failed to sync");
    } finally {
      setSyncing(false);
    }
  }

  async function toggleWindowStatus(windowId: string, currentStatus: string) {
    const newStatus = currentStatus === "open" ? "closed" : "open";
    try {
      const res = await fetch("/api/quarterly-windows", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: windowId, status: newStatus }),
      });
      if (res.ok) {
        toast.success(`Window ${newStatus === "open" ? "opened" : "closed"}`);
        fetchCycles();
      } else {
        const err = await res.json().catch(() => ({ error: "Failed to update" }));
        toast.error(err.error);
      }
    } catch {
      toast.error("Failed to update window status");
    }
  }

  async function toggleStatus(cycle: Cycle) {
    const newStatus = cycle.status === "active" ? "closed" : "active";
    try {
      const res = await fetch("/api/cycles", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: cycle.id, status: newStatus }),
      });
      if (res.ok) {
        toast.success(`Cycle ${newStatus}`);
        fetchCycles();
      } else {
        const err = await res.json().catch(() => ({ error: "Failed to update" }));
        toast.error(err.error);
      }
    } catch {
      toast.error("Failed to update cycle status");
    }
  }

  return (
    <div>
      <Header title="Cycle Management" />
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-sm text-muted-foreground">
              Configure goal-setting cycles and quarterly windows
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Windows auto-sync with their dates on page load. Use manual controls or Sync Now to override.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleSync} disabled={syncing}>
              <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? "animate-spin" : ""}`} />
              Sync Now
            </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger render={<Button />}>
              <Plus className="h-4 w-4 mr-2" /> New Cycle
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create New Cycle</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Cycle Name</Label>
                    <Input
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      placeholder="FY 2026-27"
                      required
                    />
                  </div>
                  <div>
                    <Label>Year</Label>
                    <Input
                      type="number"
                      value={form.year}
                      onChange={(e) => setForm({ ...form, year: parseInt(e.target.value) })}
                      required
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Goal Setting Start</Label>
                    <Input
                      type="date"
                      value={form.goal_setting_start}
                      onChange={(e) => setForm({ ...form, goal_setting_start: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label>Goal Setting End</Label>
                    <Input
                      type="date"
                      value={form.goal_setting_end}
                      onChange={(e) => setForm({ ...form, goal_setting_end: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <div className="border-t pt-4">
                  <h4 className="font-medium mb-3">Quarterly Windows</h4>
                  {(["Q1", "Q2", "Q3", "Q4"] as const).map((q) => {
                    const openKey = `${q.toLowerCase()}_open` as keyof typeof form;
                    const closeKey = `${q.toLowerCase()}_close` as keyof typeof form;
                    return (
                      <div key={q} className="grid grid-cols-3 gap-2 mb-2 items-center">
                        <Label className="text-sm">{q}</Label>
                        <Input
                          type="date"
                          value={form[openKey] as string}
                          onChange={(e) => setForm({ ...form, [openKey]: e.target.value })}
                          placeholder="Open"
                        />
                        <Input
                          type="date"
                          value={form[closeKey] as string}
                          onChange={(e) => setForm({ ...form, [closeKey]: e.target.value })}
                          placeholder="Close"
                        />
                      </div>
                    );
                  })}
                </div>
                <Button type="submit" className="w-full">Create Cycle</Button>
              </form>
            </DialogContent>
          </Dialog>
          </div>
        </div>

        {loading ? (
          <div className="animate-pulse text-muted-foreground">Loading cycles...</div>
        ) : (
          <div className="space-y-4">
            {cycles.map((cycle) => (
              <Card key={cycle.id}>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Calendar className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <CardTitle className="text-lg">{cycle.name}</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        Goal Setting: {formatDate(cycle.goal_setting_start)} - {formatDate(cycle.goal_setting_end)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={cycle.status === "active" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}>
                      {cycle.status}
                    </Badge>
                    <Button variant="outline" size="sm" onClick={() => toggleStatus(cycle)}>
                      {cycle.status === "active" ? "Close" : "Reopen"}
                    </Button>
                  </div>
                </CardHeader>
                {cycle.quarterly_windows?.length > 0 && (
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Quarter</TableHead>
                          <TableHead>Window Opens</TableHead>
                          <TableHead>Window Closes</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {cycle.quarterly_windows.map((w) => {
                          const inRange = isWithinDateRange(w.window_open, w.window_close);
                          return (
                            <TableRow key={w.id}>
                              <TableCell className="font-medium">{w.quarter}</TableCell>
                              <TableCell>{formatDate(w.window_open)}</TableCell>
                              <TableCell>{formatDate(w.window_close)}</TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Badge
                                    className={
                                      w.status === "open"
                                        ? "bg-green-100 text-green-800"
                                        : "bg-gray-100 text-gray-800"
                                    }
                                  >
                                    {w.status}
                                  </Badge>
                                  {inRange && w.status === "closed" && (
                                    <span className="text-xs text-amber-600">Scheduled to be open</span>
                                  )}
                                  {!inRange && w.status === "open" && (
                                    <span className="text-xs text-amber-600">Manually opened</span>
                                  )}
                                  {inRange && w.status === "open" && (
                                    <span className="text-xs text-green-600">Auto</span>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-right">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => toggleWindowStatus(w.id, w.status)}
                                >
                                  {w.status === "open" ? "Close Window" : "Open Window"}
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </CardContent>
                )}
              </Card>
            ))}
            {cycles.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                No cycles found. Create one to get started.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
