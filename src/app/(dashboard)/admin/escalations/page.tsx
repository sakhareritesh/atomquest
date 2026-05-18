"use client";

import { useEffect, useState, useCallback } from "react";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertTriangle,
  Plus,
  CheckCircle,
  Radar,
  ArrowUpCircle,
  Clock,
  Shield,
  Users,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { formatDateTime } from "@/lib/utils/date-utils";
import type { Escalation, EscalationViolation, User } from "@/types";

const RULE_LABELS: Record<string, string> = {
  goal_not_submitted: "Goal Not Submitted",
  approval_pending: "Approval Pending Too Long",
  checkin_missing: "Check-in Not Completed",
  achievement_not_updated: "Achievement Not Updated",
};

const RULE_COLORS: Record<string, string> = {
  goal_not_submitted: "bg-red-100 text-red-800",
  approval_pending: "bg-amber-100 text-amber-800",
  checkin_missing: "bg-orange-100 text-orange-800",
  achievement_not_updated: "bg-purple-100 text-purple-800",
};

type EscalationWithUser = Escalation & { target_user: User };
type ViolationWithUser = EscalationViolation & { target_user: User };

export default function EscalationsPage() {
  const [escalations, setEscalations] = useState<EscalationWithUser[]>([]);
  const [violations, setViolations] = useState<ViolationWithUser[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    rule_type: "goal_not_submitted",
    target_user_id: "",
    escalation_level: 1,
    message: "",
    deadline: "",
    violation_id: "",
  });

  const fetchEscalations = useCallback(async () => {
    try {
      const res = await fetch("/api/escalations");
      if (!res.ok) return;
      const data = await res.json();
      setEscalations(data.escalations || []);
    } catch {
      /* ignore */
    }
  }, []);

  const fetchViolations = useCallback(async () => {
    try {
      const res = await fetch("/api/escalations/scan?show_escalated=false");
      if (!res.ok) return;
      const data = await res.json();
      setViolations(data.violations || []);
    } catch {
      /* ignore */
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/users");
      if (!res.ok) return;
      const data = await res.json();
      setUsers(data.users || []);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    Promise.all([fetchEscalations(), fetchViolations(), fetchUsers()]).finally(
      () => setLoading(false)
    );
  }, [fetchEscalations, fetchViolations, fetchUsers]);

  async function handleScan() {
    setScanning(true);
    try {
      const res = await fetch("/api/escalations/scan", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        const total = data.summary.total_violations;
        toast.success(`Scan complete: ${total} violation${total !== 1 ? "s" : ""} detected`);
        await fetchViolations();
      } else {
        toast.error("Scan failed");
      }
    } catch {
      toast.error("Scan failed");
    } finally {
      setScanning(false);
    }
  }

  function openCreateFromViolation(violation: ViolationWithUser) {
    setForm({
      rule_type: violation.rule_type,
      target_user_id: violation.target_user_id,
      escalation_level: violation.target_user?.role === "manager" ? 2 : 1,
      message: "",
      deadline: "",
      violation_id: violation.id,
    });
    setOpen(true);
  }

  function openCreateManual() {
    setForm({
      rule_type: "goal_not_submitted",
      target_user_id: "",
      escalation_level: 1,
      message: "",
      deadline: "",
      violation_id: "",
    });
    setOpen(true);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.target_user_id) {
      toast.error("Please select a target user");
      return;
    }
    try {
      const res = await fetch("/api/escalations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          deadline: form.deadline || null,
          violation_id: form.violation_id || null,
          message: form.message || null,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        toast.success(
          `Escalation created — ${data.notifications_sent} notification${data.notifications_sent !== 1 ? "s" : ""} sent`
        );
        setOpen(false);
        fetchEscalations();
        fetchViolations();
      } else {
        const err = await res.json().catch(() => ({ error: "Failed to create" }));
        toast.error(err.error);
      }
    } catch {
      toast.error("Failed to create escalation");
    }
  }

  async function resolveEscalation(id: string) {
    try {
      const res = await fetch("/api/escalations", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: "resolved" }),
      });
      if (res.ok) {
        toast.success("Escalation resolved");
        fetchEscalations();
      } else {
        const err = await res.json().catch(() => ({ error: "Failed to resolve" }));
        toast.error(err.error);
      }
    } catch {
      toast.error("Failed to resolve escalation");
    }
  }

  async function reescalate(id: string, currentLevel: number) {
    const newLevel = Math.min(currentLevel + 1, 3);
    try {
      const res = await fetch("/api/escalations", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, escalation_level: newLevel }),
      });
      if (res.ok) {
        toast.success(`Re-escalated to Level ${newLevel}`);
        fetchEscalations();
      } else {
        const err = await res.json().catch(() => ({ error: "Failed" }));
        toast.error(err.error);
      }
    } catch {
      toast.error("Failed to re-escalate");
    }
  }

  const selectedUser = users.find((u) => u.id === form.target_user_id);
  const selectedManager = selectedUser?.manager_id
    ? users.find((u) => u.id === selectedUser.manager_id)
    : null;

  function getNotificationPreview(): string[] {
    if (!selectedUser) return [];
    const recipients: string[] = [];
    const level = form.escalation_level;

    if (selectedUser.role === "employee" || level === 1) {
      recipients.push(selectedUser.name);
      if (selectedManager) recipients.push(`Manager: ${selectedManager.name}`);
    }
    if (selectedUser.role === "manager" || level === 2) {
      if (!recipients.includes(selectedUser.name)) recipients.push(selectedUser.name);
      recipients.push("All Admins");
    }
    if (level >= 3) {
      if (!recipients.includes(selectedUser.name)) recipients.push(selectedUser.name);
      if (selectedManager && !recipients.find((r) => r.includes(selectedManager.name))) {
        recipients.push(`Manager: ${selectedManager.name}`);
      }
      if (!recipients.includes("All Admins")) recipients.push("All Admins");
    }
    return recipients;
  }

  const pendingEscalations = escalations.filter(
    (e) => e.status === "pending" || e.status === "escalated"
  );
  const resolvedEscalations = escalations.filter((e) => e.status === "resolved");

  function getDeadlineStatus(deadline: string | null) {
    if (!deadline) return null;
    const d = new Date(deadline);
    const now = new Date();
    const diffMs = d.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / 86400000);
    if (diffDays < 0) return { label: `${Math.abs(diffDays)}d overdue`, color: "text-red-600" };
    if (diffDays === 0) return { label: "Due today", color: "text-amber-600" };
    if (diffDays <= 3) return { label: `${diffDays}d left`, color: "text-amber-600" };
    return { label: `${diffDays}d left`, color: "text-muted-foreground" };
  }

  const levelLabels: Record<number, { label: string; icon: React.ReactNode }> = {
    1: { label: "Employee", icon: <Users className="h-3 w-3" /> },
    2: { label: "Manager", icon: <Shield className="h-3 w-3" /> },
    3: { label: "Skip-level/HR", icon: <AlertTriangle className="h-3 w-3" /> },
  };

  if (loading) {
    return (
      <div>
        <Header title="Escalations" />
        <div className="flex items-center justify-center h-64">
          <div className="animate-pulse text-muted-foreground">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Header title="Escalations" />
      <div className="p-6 space-y-6">
        {/* Summary cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-blue-600">
                {violations.length}
              </div>
              <p className="text-sm text-muted-foreground">Violations Detected</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-yellow-600">
                {pendingEscalations.filter((e) => e.status === "pending").length}
              </div>
              <p className="text-sm text-muted-foreground">Pending Escalations</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-orange-600">
                {pendingEscalations.filter((e) => e.status === "escalated").length}
              </div>
              <p className="text-sm text-muted-foreground">Re-escalated</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-green-600">
                {resolvedEscalations.length}
              </div>
              <p className="text-sm text-muted-foreground">Resolved</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="violations">
          <div className="flex items-center justify-between">
            <TabsList>
              <TabsTrigger value="violations">
                <Radar className="h-4 w-4 mr-1" />
                Violations Detected
                {violations.length > 0 && (
                  <Badge variant="secondary" className="ml-1.5 bg-blue-100 text-blue-800">
                    {violations.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="active">
                <AlertTriangle className="h-4 w-4 mr-1" />
                Active Escalations
                {pendingEscalations.length > 0 && (
                  <Badge variant="secondary" className="ml-1.5 bg-amber-100 text-amber-800">
                    {pendingEscalations.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="resolved">
                <CheckCircle className="h-4 w-4 mr-1" />
                Resolved
              </TabsTrigger>
            </TabsList>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleScan} disabled={scanning}>
                {scanning ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Radar className="h-4 w-4 mr-2" />
                )}
                {scanning ? "Scanning..." : "Scan Now"}
              </Button>
              <Button onClick={openCreateManual}>
                <Plus className="h-4 w-4 mr-2" /> Create Escalation
              </Button>
            </div>
          </div>

          {/* Tab 1: Violations */}
          <TabsContent value="violations">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Radar className="h-5 w-5" />
                  Auto-Detected Violations
                </CardTitle>
              </CardHeader>
              <CardContent>
                {violations.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Radar className="h-10 w-10 mx-auto mb-3 opacity-30" />
                    <p className="font-medium">No violations detected</p>
                    <p className="text-sm mt-1">
                      Click &quot;Scan Now&quot; to check for pending items across the organization
                    </p>
                  </div>
                ) : (
                  <div className="border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Violation Type</TableHead>
                          <TableHead>User</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead>Department</TableHead>
                          <TableHead>Detected</TableHead>
                          <TableHead>Details</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {violations.map((v) => (
                          <TableRow key={v.id}>
                            <TableCell>
                              <Badge className={RULE_COLORS[v.rule_type] || ""}>
                                {RULE_LABELS[v.rule_type] || v.rule_type}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-medium">
                              {v.target_user?.name || "-"}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="capitalize">
                                {v.target_user?.role}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {v.target_user?.department || "-"}
                            </TableCell>
                            <TableCell className="text-xs">
                              {formatDateTime(v.detected_at)}
                            </TableCell>
                            <TableCell className="text-xs max-w-48 truncate">
                              {formatViolationDetails(v)}
                            </TableCell>
                            <TableCell>
                              <Button
                                size="sm"
                                onClick={() => openCreateFromViolation(v)}
                              >
                                <ArrowUpCircle className="h-3.5 w-3.5 mr-1" />
                                Escalate
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab 2: Active Escalations */}
          <TabsContent value="active">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  Active Escalations
                </CardTitle>
              </CardHeader>
              <CardContent>
                {pendingEscalations.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <CheckCircle className="h-10 w-10 mx-auto mb-3 opacity-30" />
                    <p className="font-medium">No active escalations</p>
                    <p className="text-sm mt-1">All clear!</p>
                  </div>
                ) : (
                  <div className="border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Rule</TableHead>
                          <TableHead>User</TableHead>
                          <TableHead>Level</TableHead>
                          <TableHead>Message</TableHead>
                          <TableHead>Deadline</TableHead>
                          <TableHead>Created</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pendingEscalations.map((esc) => {
                          const deadlineStatus = getDeadlineStatus(esc.deadline);
                          const lvl = levelLabels[esc.escalation_level] || levelLabels[1];
                          return (
                            <TableRow key={esc.id}>
                              <TableCell>
                                <Badge className={RULE_COLORS[esc.rule_type] || ""}>
                                  {RULE_LABELS[esc.rule_type] || esc.rule_type}
                                </Badge>
                              </TableCell>
                              <TableCell className="font-medium">
                                {esc.target_user?.name || "-"}
                                <div className="text-xs text-muted-foreground capitalize">
                                  {esc.target_user?.role} &middot; {esc.target_user?.department}
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="gap-1">
                                  {lvl.icon}
                                  L{esc.escalation_level} — {lvl.label}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-sm max-w-48 truncate">
                                {esc.message || (
                                  <span className="text-muted-foreground italic">No message</span>
                                )}
                              </TableCell>
                              <TableCell>
                                {deadlineStatus ? (
                                  <div className="flex items-center gap-1">
                                    <Clock className="h-3.5 w-3.5" />
                                    <span className={`text-sm font-medium ${deadlineStatus.color}`}>
                                      {deadlineStatus.label}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground text-sm">—</span>
                                )}
                              </TableCell>
                              <TableCell className="text-xs">
                                {formatDateTime(esc.triggered_at)}
                              </TableCell>
                              <TableCell>
                                <Badge
                                  className={
                                    esc.status === "pending"
                                      ? "bg-yellow-100 text-yellow-800"
                                      : "bg-red-100 text-red-800"
                                  }
                                >
                                  {esc.status}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => resolveEscalation(esc.id)}
                                  >
                                    <CheckCircle className="h-4 w-4 mr-1" /> Resolve
                                  </Button>
                                  {esc.escalation_level < 3 && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="text-orange-600 hover:text-orange-700"
                                      onClick={() =>
                                        reescalate(esc.id, esc.escalation_level)
                                      }
                                    >
                                      <ArrowUpCircle className="h-4 w-4 mr-1" /> Re-escalate
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab 3: Resolved */}
          <TabsContent value="resolved">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <CheckCircle className="h-5 w-5" />
                  Resolved Escalations
                </CardTitle>
              </CardHeader>
              <CardContent>
                {resolvedEscalations.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <p>No resolved escalations yet</p>
                  </div>
                ) : (
                  <div className="border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Rule</TableHead>
                          <TableHead>User</TableHead>
                          <TableHead>Level</TableHead>
                          <TableHead>Message</TableHead>
                          <TableHead>Created</TableHead>
                          <TableHead>Resolved</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {resolvedEscalations.map((esc) => (
                          <TableRow key={esc.id}>
                            <TableCell>
                              <Badge className={RULE_COLORS[esc.rule_type] || ""} variant="outline">
                                {RULE_LABELS[esc.rule_type] || esc.rule_type}
                              </Badge>
                            </TableCell>
                            <TableCell>{esc.target_user?.name || "-"}</TableCell>
                            <TableCell>
                              <Badge variant="outline">Level {esc.escalation_level}</Badge>
                            </TableCell>
                            <TableCell className="text-sm max-w-48 truncate">
                              {esc.message || "—"}
                            </TableCell>
                            <TableCell className="text-xs">
                              {formatDateTime(esc.triggered_at)}
                            </TableCell>
                            <TableCell className="text-xs">
                              {esc.resolved_at ? formatDateTime(esc.resolved_at) : "—"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Create Escalation Dialog */}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Create Escalation</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <Label>Rule Type</Label>
                <Select
                  value={form.rule_type}
                  onValueChange={(v) => v && setForm({ ...form, rule_type: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="goal_not_submitted">Goal Not Submitted</SelectItem>
                    <SelectItem value="approval_pending">Approval Pending Too Long</SelectItem>
                    <SelectItem value="checkin_missing">Check-in Not Completed</SelectItem>
                    <SelectItem value="achievement_not_updated">Achievement Not Updated</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Target User</Label>
                <Select
                  value={form.target_user_id}
                  onValueChange={(v) => {
                    if (!v) return;
                    const u = users.find((usr) => usr.id === v);
                    setForm({
                      ...form,
                      target_user_id: v,
                      escalation_level: u?.role === "manager" ? 2 : 1,
                    });
                  }}
                  items={users.map((u) => ({ value: u.id, label: `${u.name} (${u.role})` }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select user" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name} ({u.role})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Escalation Level</Label>
                <Select
                  value={String(form.escalation_level)}
                  onValueChange={(v) =>
                    v && setForm({ ...form, escalation_level: parseInt(v) })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Level 1 — Employee</SelectItem>
                    <SelectItem value="2">Level 2 — Manager</SelectItem>
                    <SelectItem value="3">Level 3 — Skip-level / HR</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Message (optional)</Label>
                <Textarea
                  placeholder="Add context or instructions for the recipient..."
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  rows={3}
                />
              </div>
              <div>
                <Label>Deadline (optional)</Label>
                <Input
                  type="date"
                  value={form.deadline}
                  onChange={(e) => setForm({ ...form, deadline: e.target.value })}
                />
              </div>

              {/* Notification Preview */}
              {form.target_user_id && (
                <div className="rounded-lg border bg-muted/50 p-3 space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Notifications will be sent to:
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {getNotificationPreview().map((name, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">
                        {name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <Button type="submit" className="w-full">
                Create Escalation & Send Notifications
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

function formatViolationDetails(v: ViolationWithUser): string {
  const d = v.details as Record<string, unknown>;
  if (v.rule_type === "goal_not_submitted") {
    return `Sheet: ${d.sheet_status || "not created"}`;
  }
  if (v.rule_type === "approval_pending") {
    return `${d.employee_name || "Employee"} — ${d.days_pending || "?"}d pending`;
  }
  if (v.rule_type === "checkin_missing") {
    return `${d.employee_name || "Employee"} — ${d.quarter || "?"}`;
  }
  if (v.rule_type === "achievement_not_updated") {
    const quarters = d.quarters_missing;
    return `Missing: ${Array.isArray(quarters) ? quarters.join(", ") : "?"}`;
  }
  return JSON.stringify(d);
}
