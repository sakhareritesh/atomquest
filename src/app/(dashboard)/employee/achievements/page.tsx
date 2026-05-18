"use client";

import { useEffect, useState, useCallback } from "react";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { TrendingUp, Lock } from "lucide-react";
import { toast } from "sonner";
import { getScoreColor, getStatusColor, getUomLabel } from "@/lib/utils/score-calculator";
import { getCurrentQuarter, getQuarterLabel, formatDate } from "@/lib/utils/date-utils";
import type { Goal, Achievement, Quarter, ProgressStatus, QuarterlyWindow } from "@/types";

export default function AchievementsPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [quarterlyWindows, setQuarterlyWindows] = useState<QuarterlyWindow[]>([]);
  const [overallScores, setOverallScores] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [updateOpen, setUpdateOpen] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null);
  const [selectedQuarter, setSelectedQuarter] = useState<Quarter>("Q1");
  const [currentQ, setCurrentQ] = useState<string>("");
  const [formData, setFormData] = useState({
    planned_target: "",
    actual_achievement: "",
    completion_date: "",
    progress_status: "not_started" as ProgressStatus,
  });

  useEffect(() => {
    const q = getCurrentQuarter();
    setSelectedQuarter(q);
    setCurrentQ(q);
  }, []);

  function isQuarterEditable(quarter: Quarter): boolean {
    const win = quarterlyWindows.find((w) => w.quarter === quarter);
    if (!win) return false;
    if (win.status !== "open") return false;
    const now = new Date();
    const open = new Date(win.window_open);
    const close = new Date(win.window_close);
    return now >= open && now <= close;
  }

  function getWindowForQuarter(quarter: Quarter): QuarterlyWindow | undefined {
    return quarterlyWindows.find((w) => w.quarter === quarter);
  }

  const fetchData = useCallback(async () => {
    try {
      const [dashRes, achRes] = await Promise.all([
        fetch("/api/dashboard"),
        fetch("/api/achievements"),
      ]);
      const dashData = await dashRes.json();
      const achData = await achRes.json();

      const lockedGoals = (dashData.goalSheet?.goals || []).filter(
        (g: Goal) => g.status === "locked" || g.status === "approved"
      );
      setGoals(lockedGoals);
      setAchievements(achData.achievements || []);
      setQuarterlyWindows(dashData.quarterlyWindows || []);
      setOverallScores(dashData.overallScores || {});
    } catch {
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function getAchievement(goalId: string, quarter: Quarter): Achievement | undefined {
    return achievements.find((a) => a.goal_id === goalId && a.quarter === quarter);
  }

  function openUpdate(goal: Goal, quarter: Quarter) {
    setSelectedGoal(goal);
    setSelectedQuarter(quarter);
    const existing = getAchievement(goal.id, quarter);
    setFormData({
      planned_target: String(existing?.planned_target ?? ""),
      actual_achievement: String(existing?.actual_achievement ?? ""),
      completion_date: existing?.completion_date || "",
      progress_status: existing?.progress_status || "not_started",
    });
    setUpdateOpen(true);
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedGoal) return;

    const isTimeline = selectedGoal.uom_type === "timeline";

    try {
      const res = await fetch("/api/achievements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goal_id: selectedGoal.id,
          quarter: selectedQuarter,
          planned_target: isTimeline ? null : (parseFloat(formData.planned_target) || null),
          actual_achievement: isTimeline ? 0 : (parseFloat(formData.actual_achievement) || 0),
          completion_date: isTimeline ? formData.completion_date || null : null,
          progress_status: formData.progress_status,
        }),
      });
      if (res.ok) {
        toast.success("Achievement updated");
        setUpdateOpen(false);
        await fetchData();
      } else {
        const err = await res.json();
        toast.error(err.error);
      }
    } catch {
      toast.error("Failed to update");
    }
  }

  const quarters: Quarter[] = ["Q1", "Q2", "Q3", "Q4"];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-pulse text-muted-foreground">Loading achievements...</div>
      </div>
    );
  }

  return (
    <div>
      <Header title="Achievement Tracking" />
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-3">
          <TrendingUp className="h-5 w-5 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Log your actual achievements against planned targets for each quarter
          </p>
          {currentQ && <Badge variant="outline">Current: {currentQ}</Badge>}
        </div>

        {goals.length > 0 && (
          <div className="grid grid-cols-4 gap-4">
            {quarters.map((q) => {
              const score = overallScores[q] ?? 0;
              const win = getWindowForQuarter(q);
              const editable = isQuarterEditable(q);
              return (
                <Card key={q}>
                  <CardContent className="pt-4 pb-3 px-4">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">{getQuarterLabel(q)}</span>
                      {editable ? (
                        <Badge className="bg-green-100 text-green-800 text-xs">Open</Badge>
                      ) : (
                        <Badge className="bg-gray-100 text-gray-800 text-xs">
                          <Lock className="h-3 w-3 mr-1" />
                          Closed
                        </Badge>
                      )}
                    </div>
                    <div className={`text-2xl font-bold ${getScoreColor(score)}`}>
                      {score > 0 ? `${score.toFixed(0)}%` : "—"}
                    </div>
                    <p className="text-xs text-muted-foreground">Weighted Score</p>
                    {win && editable && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Closes: {formatDate(win.window_close)}
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        <Dialog open={updateOpen} onOpenChange={setUpdateOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Update Achievement</DialogTitle>
            </DialogHeader>
            {selectedGoal && (
              <div className="space-y-4">
                <div className="p-3 bg-muted rounded-lg">
                  <p className="font-medium text-sm">{selectedGoal.title}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {getUomLabel(selectedGoal.uom_type)} | Target:{" "}
                    {selectedGoal.target_value ?? selectedGoal.target_date}
                  </p>
                  <Badge variant="outline" className="mt-2">
                    {getQuarterLabel(selectedQuarter)}
                  </Badge>
                </div>
                <form onSubmit={handleUpdate} className="space-y-4">
                  {selectedGoal.uom_type === "timeline" ? (
                    <div>
                      <Label>Completion Date</Label>
                      <Input
                        type="date"
                        value={formData.completion_date}
                        onChange={(e) =>
                          setFormData({ ...formData, completion_date: e.target.value })
                        }
                        required
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Target: {selectedGoal.target_date} — Score is 100% if completed on/before target
                      </p>
                    </div>
                  ) : (
                    <>
                      <div>
                        <Label>Planned Target for this Quarter</Label>
                        <Input
                          type="number"
                          step="any"
                          value={formData.planned_target}
                          onChange={(e) =>
                            setFormData({ ...formData, planned_target: e.target.value })
                          }
                          placeholder={`Overall target: ${selectedGoal.target_value}`}
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          What you plan to achieve this quarter (optional)
                        </p>
                      </div>
                      <div>
                        <Label>Actual Achievement</Label>
                        <Input
                          type="number"
                          step="any"
                          value={formData.actual_achievement}
                          onChange={(e) =>
                            setFormData({ ...formData, actual_achievement: e.target.value })
                          }
                          required
                        />
                      </div>
                    </>
                  )}
                  <div>
                    <Label>Progress Status</Label>
                    <Select
                      value={formData.progress_status}
                      onValueChange={(v) =>
                        v && setFormData({ ...formData, progress_status: v as ProgressStatus })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="not_started">Not Started</SelectItem>
                        <SelectItem value="on_track">On Track</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button type="submit" className="w-full">Save Achievement</Button>
                </form>
              </div>
            )}
          </DialogContent>
        </Dialog>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Achievement Grid</CardTitle>
          </CardHeader>
          <CardContent>
            {goals.length > 0 ? (
              <div className="border rounded-lg overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[200px]">Goal</TableHead>
                      <TableHead>Target</TableHead>
                      {quarters.map((q) => {
                        const editable = isQuarterEditable(q);
                        return (
                          <TableHead key={q} className="text-center min-w-[120px]">
                            <div className="flex flex-col items-center gap-1">
                              <span>{q}</span>
                              {!editable && (
                                <Lock className="h-3 w-3 text-muted-foreground" />
                              )}
                            </div>
                          </TableHead>
                        );
                      })}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {goals.map((goal) => (
                      <TableRow key={goal.id}>
                        <TableCell>
                          <div className="font-medium text-sm">{goal.title}</div>
                          <div className="text-xs text-muted-foreground">
                            {getUomLabel(goal.uom_type)} | W: {goal.weightage}%
                          </div>
                        </TableCell>
                        <TableCell>
                          {goal.uom_type === "timeline"
                            ? goal.target_date
                            : goal.target_value}
                        </TableCell>
                        {quarters.map((q) => {
                          const ach = getAchievement(goal.id, q);
                          const editable = isQuarterEditable(q);
                          return (
                            <TableCell key={q} className="text-center">
                              {ach ? (
                                <div
                                  className={editable ? "cursor-pointer hover:bg-accent rounded p-1" : "rounded p-1 opacity-80"}
                                  onClick={editable ? () => openUpdate(goal, q) : undefined}
                                >
                                  {goal.uom_type !== "timeline" && ach.planned_target != null && (
                                    <div className="text-xs text-muted-foreground">
                                      P: {ach.planned_target}
                                    </div>
                                  )}
                                  <div className="text-sm font-medium">
                                    {goal.uom_type === "timeline"
                                      ? (ach.completion_date || "—")
                                      : `A: ${ach.actual_achievement}`}
                                  </div>
                                  <div className={`text-xs ${getScoreColor(ach.computed_score || 0)}`}>
                                    {ach.computed_score?.toFixed(0)}%
                                  </div>
                                  <Badge
                                    variant="secondary"
                                    className={`text-xs ${getStatusColor(ach.progress_status)}`}
                                  >
                                    {ach.progress_status.replace("_", " ")}
                                  </Badge>
                                </div>
                              ) : editable ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-xs"
                                  onClick={() => openUpdate(goal, q)}
                                >
                                  Enter
                                </Button>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <p>No locked goals found. Goals must be approved before tracking achievements.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
