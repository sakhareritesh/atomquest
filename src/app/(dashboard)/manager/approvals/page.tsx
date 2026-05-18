"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
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
import { CheckCircle, XCircle, Eye, AlertCircle, Clock } from "lucide-react";
import { toast } from "sonner";
import { useAuthStore } from "@/hooks/use-auth";
import { getUomLabel, getStatusColor } from "@/lib/utils/score-calculator";
import { formatDateTime } from "@/lib/utils/date-utils";
import type { GoalSheet, Goal } from "@/types";

export default function ApprovalsPage() {
  const { user } = useAuthStore();
  const [sheets, setSheets] = useState<GoalSheet[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSheet, setSelectedSheet] = useState<GoalSheet | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editedGoals, setEditedGoals] = useState<
    Record<string, { weightage?: number; target_value?: number; target_date?: string }>
  >({});
  const [rejectReason, setRejectReason] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchSheets = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch(`/api/goal-sheets?manager_id=${user.id}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setSheets(data.goalSheets || []);
    } catch {
      toast.error("Failed to load approvals");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchSheets();
  }, [fetchSheets]);

  const pendingSheets = sheets.filter((s) => s.status === "submitted");
  const otherSheets = sheets.filter((s) => s.status !== "submitted");

  function viewSheet(sheet: GoalSheet) {
    setSelectedSheet(sheet);
    setEditedGoals({});
    setRejectReason("");
    setDetailOpen(true);
  }

  function handleGoalEdit(goalId: string, field: string, value: string) {
    setEditedGoals((prev) => ({
      ...prev,
      [goalId]: {
        ...prev[goalId],
        [field]: field === "target_date" ? value : (parseFloat(value) || 0),
      },
    }));
  }

  const effectiveWeightage = useMemo(() => {
    if (!selectedSheet?.goals) return 0;
    return selectedSheet.goals.reduce((sum, g) => {
      const edited = editedGoals[g.id];
      return sum + (edited?.weightage ?? g.weightage);
    }, 0);
  }, [selectedSheet, editedGoals]);

  async function saveEdits(): Promise<boolean> {
    for (const [goalId, changes] of Object.entries(editedGoals)) {
      const res = await fetch("/api/goals", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: goalId, ...changes }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed to save edit" }));
        toast.error(`Failed to update goal: ${err.error}`);
        return false;
      }
    }
    return true;
  }

  async function handleApprove() {
    if (!selectedSheet) return;

    if (effectiveWeightage !== 100) {
      toast.error(`Total weightage must be 100% (currently ${effectiveWeightage}%)`);
      return;
    }

    const goalsToCheck = selectedSheet.goals || [];
    for (const g of goalsToCheck) {
      const w = editedGoals[g.id]?.weightage ?? g.weightage;
      if (w < 10) {
        toast.error(`"${g.title}" has weightage below 10%`);
        return;
      }
    }

    setSaving(true);
    try {
      if (Object.keys(editedGoals).length > 0) {
        const ok = await saveEdits();
        if (!ok) { setSaving(false); return; }
      }
      const res = await fetch("/api/goal-sheets", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selectedSheet.id, status: "approved" }),
      });
      if (res.ok) {
        toast.success("Goal sheet approved and locked");
        setDetailOpen(false);
        await fetchSheets();
      } else {
        const err = await res.json().catch(() => ({ error: "Approval failed" }));
        toast.error(err.error);
      }
    } catch {
      toast.error("Failed to approve");
    } finally {
      setSaving(false);
    }
  }

  async function handleReject() {
    if (!selectedSheet) return;
    setSaving(true);
    try {
      const res = await fetch("/api/goal-sheets", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedSheet.id,
          status: "rejected",
          reject_reason: rejectReason || null,
        }),
      });
      if (res.ok) {
        toast.success("Goal sheet returned for rework");
        setDetailOpen(false);
        await fetchSheets();
      } else {
        const err = await res.json().catch(() => ({ error: "Rejection failed" }));
        toast.error(err.error);
      }
    } catch {
      toast.error("Failed to reject");
    } finally {
      setSaving(false);
    }
  }

  function renderTarget(goal: Goal, isEditable: boolean) {
    if (goal.uom_type === "timeline") {
      if (isEditable) {
        return (
          <Input
            type="date"
            defaultValue={goal.target_date || ""}
            onChange={(e) => handleGoalEdit(goal.id, "target_date", e.target.value)}
            className="w-36 h-8"
          />
        );
      }
      return goal.target_date || "-";
    }

    if (isEditable) {
      return (
        <Input
          type="number"
          step="any"
          defaultValue={goal.target_value ?? ""}
          onChange={(e) => handleGoalEdit(goal.id, "target_value", e.target.value)}
          className="w-28 h-8"
        />
      );
    }
    return goal.target_value ?? "-";
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-pulse text-muted-foreground">Loading approvals...</div>
      </div>
    );
  }

  return (
    <div>
      <Header title="Goal Approvals" />
      <div className="p-6 space-y-6">
        <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
          <DialogContent className="sm:max-w-[95vw] lg:max-w-6xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between">
                <span>Review Goal Sheet - {selectedSheet?.employee?.name}</span>
                {selectedSheet?.submitted_at && (
                  <span className="text-xs font-normal text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Submitted: {formatDateTime(selectedSheet.submitted_at)}
                  </span>
                )}
              </DialogTitle>
            </DialogHeader>
            {selectedSheet?.goals && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge
                    variant={effectiveWeightage === 100 ? "outline" : "destructive"}
                  >
                    Total Weightage: {effectiveWeightage}%
                  </Badge>
                  <Badge variant="outline">
                    Goals: {selectedSheet.goals.length}
                  </Badge>
                  {selectedSheet.employee?.department && (
                    <Badge variant="secondary">{selectedSheet.employee.department}</Badge>
                  )}
                  {effectiveWeightage !== 100 && selectedSheet.status === "submitted" && (
                    <span className="text-xs text-destructive flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      Must equal 100% to approve
                    </span>
                  )}
                </div>

                <div className="border rounded-lg overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10">#</TableHead>
                        <TableHead className="min-w-[200px]">Goal</TableHead>
                        <TableHead className="min-w-[120px]">Thrust Area</TableHead>
                        <TableHead className="w-28">UoM</TableHead>
                        <TableHead className="w-36">Target</TableHead>
                        <TableHead className="w-24">Wt. (%)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedSheet.goals.map((goal: Goal, idx: number) => {
                        const isSubmitted = selectedSheet.status === "submitted";
                        return (
                          <TableRow key={goal.id}>
                            <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                            <TableCell>
                              <div className="font-medium text-sm">{goal.title}</div>
                              <div className="text-xs text-muted-foreground line-clamp-2">
                                {goal.description}
                              </div>
                              {goal.shared_goal_id && !goal.is_primary_owner && (
                                <Badge variant="outline" className="text-xs mt-1">Shared</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-sm">
                              {goal.thrust_area?.name || "-"}
                            </TableCell>
                            <TableCell className="text-xs">
                              {getUomLabel(goal.uom_type)}
                            </TableCell>
                            <TableCell>
                              {renderTarget(goal, isSubmitted)}
                            </TableCell>
                            <TableCell>
                              {isSubmitted ? (
                                <Input
                                  type="number"
                                  min={10}
                                  max={100}
                                  defaultValue={goal.weightage}
                                  onChange={(e) =>
                                    handleGoalEdit(goal.id, "weightage", e.target.value)
                                  }
                                  className="w-20 h-8"
                                />
                              ) : (
                                `${goal.weightage}%`
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                {selectedSheet.status === "submitted" && (
                  <div className="space-y-3">
                    <Textarea
                      placeholder="Add reason for rejection (optional but recommended)"
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                    />
                    <div className="flex gap-2">
                      <Button
                        onClick={handleApprove}
                        className="flex-1"
                        disabled={saving || effectiveWeightage !== 100}
                      >
                        <CheckCircle className="h-4 w-4 mr-2" /> Approve & Lock
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={handleReject}
                        className="flex-1"
                        disabled={saving}
                      >
                        <XCircle className="h-4 w-4 mr-2" /> Return for Rework
                      </Button>
                    </div>
                  </div>
                )}

                {selectedSheet.status === "rejected" && selectedSheet.reject_reason && (
                  <Card className="border-red-200 bg-red-50">
                    <CardContent className="py-3">
                      <p className="text-sm font-medium text-red-800">Reject Reason</p>
                      <p className="text-sm text-red-700">{selectedSheet.reject_reason}</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {pendingSheets.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                Pending Approvals
                <Badge>{pendingSheets.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {pendingSheets.map((sheet) => (
                  <div
                    key={sheet.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent transition-colors"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{sheet.employee?.name}</p>
                        {sheet.employee?.department && (
                          <Badge variant="outline" className="text-xs">{sheet.employee.department}</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <p className="text-sm text-muted-foreground">
                          {sheet.goals?.length} goals | Weightage: {sheet.goals?.reduce((s, g) => s + g.weightage, 0)}%
                        </p>
                        {sheet.submitted_at && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDateTime(sheet.submitted_at)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className="bg-yellow-100 text-yellow-800">
                        Pending Review
                      </Badge>
                      <Button size="sm" onClick={() => viewSheet(sheet)}>
                        <Eye className="h-4 w-4 mr-1" /> Review
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">All Goal Sheets</CardTitle>
          </CardHeader>
          <CardContent>
            {otherSheets.length > 0 ? (
              <div className="space-y-2">
                {otherSheets.map((sheet) => (
                  <div
                    key={sheet.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{sheet.employee?.name}</p>
                        {sheet.employee?.department && (
                          <Badge variant="outline" className="text-xs">{sheet.employee.department}</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <p className="text-sm text-muted-foreground">
                          {sheet.goals?.length} goals
                          {sheet.reject_reason && (
                            <span className="text-red-600 ml-2">
                              (Rejected: {sheet.reject_reason.substring(0, 50)}{sheet.reject_reason.length > 50 ? "..." : ""})
                            </span>
                          )}
                        </p>
                        {sheet.submitted_at && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Submitted: {formatDateTime(sheet.submitted_at)}
                          </span>
                        )}
                        {sheet.approved_at && (
                          <span className="text-xs text-green-600 flex items-center gap-1">
                            <CheckCircle className="h-3 w-3" />
                            Approved: {formatDateTime(sheet.approved_at)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={getStatusColor(sheet.status)}>
                        {sheet.status}
                      </Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => viewSheet(sheet)}
                      >
                        <Eye className="h-4 w-4 mr-1" /> View
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center py-8 text-muted-foreground">
                {pendingSheets.length === 0
                  ? "No goal sheets from your team yet"
                  : "All sheets shown above"}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
