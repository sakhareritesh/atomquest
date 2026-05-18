"use client";

import { useEffect, useState, useCallback } from "react";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { Plus, Send, Trash2, Edit, Lock, AlertCircle, Share2 } from "lucide-react";
import { toast } from "sonner";
import { goalSchema, validateGoalSheet } from "@/lib/validations/goal";
import { getStatusColor, getUomLabel } from "@/lib/utils/score-calculator";
import type { Goal, ThrustArea, Cycle, GoalSheet, UomType } from "@/types";

export default function GoalsPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [thrustAreas, setThrustAreas] = useState<ThrustArea[]>([]);
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [activeCycleId, setActiveCycleId] = useState("");
  const [goalSheet, setGoalSheet] = useState<GoalSheet | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    thrust_area_id: "",
    title: "",
    description: "",
    uom_type: "min_numeric" as UomType,
    target_value: "",
    target_date: "",
    weightage: "",
  });

  const fetchData = useCallback(async () => {
    try {
      const [cyclesRes, taRes] = await Promise.all([
        fetch("/api/cycles"),
        fetch("/api/thrust-areas"),
      ]);
      const cyclesData = await cyclesRes.json();
      const taData = await taRes.json();

      setCycles(cyclesData.cycles || []);
      setThrustAreas((taData.thrustAreas || []).filter((t: ThrustArea) => t.is_active));

      const active = (cyclesData.cycles || []).find((c: Cycle) => c.status === "active");
      if (active) {
        setActiveCycleId(active.id);
        await fetchGoals(active.id);
      }
    } catch {
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  async function fetchGoals(cycleId: string) {
    const [goalsRes, sheetsRes] = await Promise.all([
      fetch(`/api/goals?cycle_id=${cycleId}`),
      fetch("/api/goal-sheets?self=true"),
    ]);
    if (!goalsRes.ok || !sheetsRes.ok) {
      toast.error("Failed to load goals data");
      return;
    }
    const goalsData = await goalsRes.json();
    const sheetsData = await sheetsRes.json();

    const fetchedGoals = goalsData.goals || [];
    setGoals(fetchedGoals);

    const currentSheet = (sheetsData.goalSheets || []).find(
      (s: GoalSheet) => s.cycle_id === cycleId
    );

    if (
      currentSheet &&
      fetchedGoals.length === 0 &&
      (currentSheet.status === "approved" || currentSheet.status === "locked" || currentSheet.status === "submitted")
    ) {
      const resetRes = await fetch("/api/goal-sheets", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: currentSheet.id, status: "draft" }),
      });
      if (resetRes.ok) {
        const updated = await resetRes.json();
        setGoalSheet(updated.goalSheet || { ...currentSheet, status: "draft" });
        return;
      }
    }

    setGoalSheet(currentSheet || null);
  }

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function openCreate() {
    setEditingGoal(null);
    setFieldErrors({});
    setForm({
      thrust_area_id: "",
      title: "",
      description: "",
      uom_type: "min_numeric",
      target_value: "",
      target_date: "",
      weightage: "",
    });
    setOpen(true);
  }

  function openEdit(goal: Goal) {
    if (goal.status === "locked" || goal.status === "approved") {
      toast.error("Cannot edit locked/approved goals");
      return;
    }
    setEditingGoal(goal);
    setFieldErrors({});
    setForm({
      thrust_area_id: goal.thrust_area_id,
      title: goal.title,
      description: goal.description,
      uom_type: goal.uom_type,
      target_value: String(goal.target_value ?? ""),
      target_date: goal.target_date || "",
      weightage: String(goal.weightage),
    });
    setOpen(true);
  }

  async function handleSubmitGoal(e: React.FormEvent) {
    e.preventDefault();
    setFieldErrors({});

    const weightage = parseInt(form.weightage);
    if (isNaN(weightage)) {
      setFieldErrors({ weightage: "Weightage is required" });
      return;
    }

    const isSharedRecipient = editingGoal?.shared_goal_id && !editingGoal.is_primary_owner;

    if (isSharedRecipient) {
      if (weightage < 10 || weightage > 100) {
        setFieldErrors({ weightage: "Weightage must be between 10% and 100%" });
        return;
      }
    } else {
      const parsed = goalSchema.safeParse({
        thrust_area_id: form.thrust_area_id,
        title: form.title,
        description: form.description || "No description",
        uom_type: form.uom_type,
        target_value: form.target_value ? parseFloat(form.target_value) : null,
        target_date: form.target_date || null,
        weightage,
      });

      if (!parsed.success) {
        const errors: Record<string, string> = {};
        parsed.error.issues.forEach((issue) => {
          const key = issue.path[0]?.toString() || "form";
          if (!errors[key]) errors[key] = issue.message;
        });
        setFieldErrors(errors);
        return;
      }
    }

    try {
      if (editingGoal) {
        const body: Record<string, unknown> = { id: editingGoal.id, weightage };
        if (!isSharedRecipient) {
          body.thrust_area_id = form.thrust_area_id;
          body.title = form.title;
          body.description = form.description;
          body.uom_type = form.uom_type;
          body.target_value = form.target_value ? parseFloat(form.target_value) : null;
          body.target_date = form.target_date || null;
        }

        const res = await fetch("/api/goals", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Update failed" }));
          toast.error(err.error);
          return;
        }
        toast.success("Goal updated");
      } else {
        if (goals.length >= 8) {
          toast.error("Maximum 8 goals allowed");
          return;
        }
        const res = await fetch("/api/goals", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            cycle_id: activeCycleId,
            thrust_area_id: form.thrust_area_id,
            title: form.title,
            description: form.description || "No description",
            uom_type: form.uom_type,
            target_value: form.target_value ? parseFloat(form.target_value) : null,
            target_date: form.target_date || null,
            weightage: weightage,
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Creation failed" }));
          toast.error(err.error);
          return;
        }
        toast.success("Goal created");
      }
      setOpen(false);
      await fetchGoals(activeCycleId);
    } catch {
      toast.error("Operation failed");
    }
  }

  async function handleDelete(goalId: string) {
    if (!confirm("Delete this goal?")) return;
    const res = await fetch(`/api/goals?id=${goalId}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Goal deleted");
      await fetchGoals(activeCycleId);
    } else {
      const err = await res.json().catch(() => ({ error: "Delete failed" }));
      toast.error(err.error);
    }
  }

  async function handleSubmitSheet() {
    const validationErrors = validateGoalSheet(goals);
    if (validationErrors.length > 0) {
      validationErrors.forEach((e) => toast.error(e));
      return;
    }

    if (!goalSheet) {
      toast.error("No goal sheet found");
      return;
    }

    const res = await fetch("/api/goal-sheets", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: goalSheet.id, status: "submitted" }),
    });
    if (res.ok) {
      toast.success("Goal sheet submitted for approval");
      await fetchGoals(activeCycleId);
    } else {
      const err = await res.json().catch(() => ({ error: "Submit failed" }));
      toast.error(err.error);
    }
  }

  const totalWeightage = goals.reduce((sum, g) => sum + g.weightage, 0);
  const isEditable = !goalSheet || goalSheet.status === "draft" || goalSheet.status === "rejected";
  const isShared = (goal: Goal): boolean => !!(goal.shared_goal_id && !goal.is_primary_owner);
  const needsTarget = form.uom_type === "min_numeric" || form.uom_type === "max_numeric" || form.uom_type === "zero";
  const needsDate = form.uom_type === "timeline";

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-pulse text-muted-foreground">Loading goals...</div>
      </div>
    );
  }

  return (
    <div>
      <Header title="My Goals" />
      <div className="p-6 space-y-6">
        {!activeCycleId && (
          <Card className="border-yellow-200 bg-yellow-50">
            <CardContent className="flex items-center gap-3 py-4">
              <AlertCircle className="h-5 w-5 text-yellow-600" />
              <p className="text-sm text-yellow-800">
                No active cycle found. Contact your admin to create one before adding goals.
              </p>
            </CardContent>
          </Card>
        )}

        {goalSheet?.reject_reason && goalSheet.status === "rejected" && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="py-4">
              <p className="text-sm font-medium text-red-800">Returned for rework</p>
              <p className="text-sm text-red-700 mt-1">{goalSheet.reject_reason}</p>
            </CardContent>
          </Card>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {goalSheet && (
              <Badge className={getStatusColor(goalSheet.status)}>
                Sheet: {goalSheet.status}
              </Badge>
            )}
            <Badge variant="outline">
              Weightage: {totalWeightage}/100%
            </Badge>
            <Badge variant="outline">
              Goals: {goals.length}/8
            </Badge>
          </div>
          <div className="flex gap-2">
            {isEditable && activeCycleId && (
              <>
                <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setFieldErrors({}); }}>
                  <DialogTrigger render={<Button />} onClick={openCreate} disabled={goals.length >= 8}>
                    <Plus className="h-4 w-4 mr-2" /> Add Goal
                  </DialogTrigger>
                  <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>
                        {editingGoal ? "Edit Goal" : "Add New Goal"}
                        {editingGoal && isShared(editingGoal) && (
                          <Badge variant="secondary" className="ml-2">Shared - Weightage Only</Badge>
                        )}
                      </DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSubmitGoal} className="space-y-4">
                      {editingGoal && isShared(editingGoal) && (
                        <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
                          <p className="text-sm text-blue-800 font-medium flex items-center gap-2">
                            <Share2 className="h-4 w-4" />
                            Shared Goal — Assigned by Manager
                          </p>
                          <p className="text-xs text-blue-700 mt-1">
                            Goal title, target, and other fields are read-only. You can only adjust the weightage.
                          </p>
                        </div>
                      )}
                      <div>
                        <Label>Thrust Area</Label>
                        <Select
                          value={form.thrust_area_id}
                          onValueChange={(v) => v && setForm({ ...form, thrust_area_id: v })}
                          disabled={!!editingGoal && isShared(editingGoal)}
                          items={thrustAreas.map((ta) => ({ value: ta.id, label: ta.name }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select thrust area" />
                          </SelectTrigger>
                          <SelectContent>
                            {thrustAreas.map((ta) => (
                              <SelectItem key={ta.id} value={ta.id} label={ta.name}>{ta.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {fieldErrors.thrust_area_id && (
                          <p className="text-xs text-destructive mt-1">{fieldErrors.thrust_area_id}</p>
                        )}
                      </div>
                      <div>
                        <Label>Goal Title</Label>
                        <Input
                          value={form.title}
                          onChange={(e) => setForm({ ...form, title: e.target.value })}
                          placeholder="Enter goal title"
                          required
                          disabled={!!editingGoal && isShared(editingGoal)}
                        />
                        {fieldErrors.title && (
                          <p className="text-xs text-destructive mt-1">{fieldErrors.title}</p>
                        )}
                      </div>
                      <div>
                        <Label>Description</Label>
                        <Textarea
                          value={form.description}
                          onChange={(e) => setForm({ ...form, description: e.target.value })}
                          placeholder="Describe the goal in detail"
                          disabled={!!editingGoal && isShared(editingGoal)}
                        />
                        {fieldErrors.description && (
                          <p className="text-xs text-destructive mt-1">{fieldErrors.description}</p>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Unit of Measurement</Label>
                          <Select
                            value={form.uom_type}
                            onValueChange={(v) => v && setForm({ ...form, uom_type: v as UomType })}
                            disabled={!!editingGoal && isShared(editingGoal)}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="min_numeric" label="Numeric (Higher=Better)">Numeric (Higher=Better)</SelectItem>
                              <SelectItem value="max_numeric" label="Numeric (Lower=Better)">Numeric (Lower=Better)</SelectItem>
                              <SelectItem value="timeline" label="Timeline">Timeline</SelectItem>
                              <SelectItem value="zero" label="Zero-Based">Zero-Based</SelectItem>
                            </SelectContent>
                          </Select>
                          {fieldErrors.uom_type && (
                            <p className="text-xs text-destructive mt-1">{fieldErrors.uom_type}</p>
                          )}
                        </div>
                        <div>
                          <Label>Weightage (%)</Label>
                          <Input
                            type="number"
                            min={10}
                            max={100}
                            value={form.weightage}
                            onChange={(e) => setForm({ ...form, weightage: e.target.value })}
                            required
                          />
                          {fieldErrors.weightage && (
                            <p className="text-xs text-destructive mt-1">{fieldErrors.weightage}</p>
                          )}
                        </div>
                      </div>
                      {needsTarget && (
                        <div>
                          <Label>Target Value <span className="text-destructive">*</span></Label>
                          <Input
                            type="number"
                            step="any"
                            value={form.target_value}
                            onChange={(e) => setForm({ ...form, target_value: e.target.value })}
                            placeholder="Enter numeric target"
                            required
                            disabled={!!editingGoal && isShared(editingGoal)}
                          />
                          {fieldErrors.target_value && (
                            <p className="text-xs text-destructive mt-1">{fieldErrors.target_value}</p>
                          )}
                        </div>
                      )}
                      {needsDate && (
                        <div>
                          <Label>Target Date <span className="text-destructive">*</span></Label>
                          <Input
                            type="date"
                            value={form.target_date}
                            onChange={(e) => setForm({ ...form, target_date: e.target.value })}
                            required
                            disabled={!!editingGoal && isShared(editingGoal)}
                          />
                          {fieldErrors.target_date && (
                            <p className="text-xs text-destructive mt-1">{fieldErrors.target_date}</p>
                          )}
                        </div>
                      )}
                      <Button type="submit" className="w-full">
                        {editingGoal ? "Update Goal" : "Add Goal"}
                      </Button>
                    </form>
                  </DialogContent>
                </Dialog>
                {goals.length > 0 && totalWeightage === 100 && (
                  <Button variant="default" onClick={handleSubmitSheet}>
                    <Send className="h-4 w-4 mr-2" /> Submit for Approval
                  </Button>
                )}
              </>
            )}
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center justify-between">
              <span>Goal Sheet</span>
              <div className="flex items-center gap-2">
                <Progress value={totalWeightage} className="w-32 h-2" />
                <span className="text-sm font-normal text-muted-foreground">
                  {totalWeightage}%
                </span>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {goals.length > 0 ? (
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[40px]">#</TableHead>
                      <TableHead>Goal Title</TableHead>
                      <TableHead>Thrust Area</TableHead>
                      <TableHead>UoM</TableHead>
                      <TableHead>Target</TableHead>
                      <TableHead>Weightage</TableHead>
                      <TableHead>Status</TableHead>
                      {isEditable && <TableHead className="w-[100px]">Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {goals.map((goal, idx) => (
                      <TableRow key={goal.id}>
                        <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{goal.title}</span>
                            {isShared(goal) && (
                              <Badge variant="outline" className="text-xs border-blue-300 text-blue-700 bg-blue-50">
                                <Share2 className="h-3 w-3 mr-1" />
                                Assigned by Manager
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground truncate max-w-xs">
                            {goal.description}
                          </p>
                        </TableCell>
                        <TableCell className="text-sm">
                          {goal.thrust_area?.name || "-"}
                        </TableCell>
                        <TableCell className="text-xs">
                          {getUomLabel(goal.uom_type)}
                        </TableCell>
                        <TableCell>
                          {goal.uom_type === "timeline"
                            ? goal.target_date || "-"
                            : goal.target_value ?? "-"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{goal.weightage}%</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(goal.status)}>
                            {goal.status === "locked" && <Lock className="h-3 w-3 mr-1" />}
                            {goal.status}
                          </Badge>
                        </TableCell>
                        {isEditable && (
                          <TableCell>
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openEdit(goal)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              {!isShared(goal) && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDelete(goal.id)}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                {activeCycleId ? (
                  <p>No goals yet. Click &quot;Add Goal&quot; to get started.</p>
                ) : (
                  <p>No active cycle available. Contact your admin.</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
