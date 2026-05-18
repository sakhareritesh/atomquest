"use client";

import { useEffect, useState, useCallback } from "react";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MessageSquare, Eye } from "lucide-react";
import { toast } from "sonner";
import { useAuthStore } from "@/hooks/use-auth";
import { getCurrentQuarter, getQuarterLabel } from "@/lib/utils/date-utils";
import { getUomLabel, getScoreColor, computeOverallScore } from "@/lib/utils/score-calculator";
import type { GoalSheet, Achievement, Quarter, Checkin } from "@/types";

export default function CheckinsPage() {
  const { user } = useAuthStore();
  const [sheets, setSheets] = useState<GoalSheet[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSheet, setSelectedSheet] = useState<GoalSheet | null>(null);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [checkins, setCheckins] = useState<Checkin[]>([]);
  const [detailOpen, setDetailOpen] = useState(false);
  const [quarter, setQuarter] = useState<Quarter>("Q1");
  const [comment, setComment] = useState("");

  useEffect(() => {
    setQuarter(getCurrentQuarter());
  }, []);

  const fetchSheets = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch(`/api/goal-sheets?manager_id=${user.id}`);
      const data = await res.json();
      const approved = (data.goalSheets || []).filter(
        (s: GoalSheet) => s.status === "approved" || s.status === "locked"
      );
      setSheets(approved);
    } catch {
      toast.error("Failed to load");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchSheets();
  }, [fetchSheets]);

  async function openCheckin(sheet: GoalSheet) {
    setSelectedSheet(sheet);
    setComment("");

    const goalIds = (sheet.goals || []).map((g) => g.id);
    if (goalIds.length > 0) {
      const achs: Achievement[] = [];
      for (const gid of goalIds) {
        const res = await fetch(`/api/achievements?goal_id=${gid}`);
        const data = await res.json();
        achs.push(...(data.achievements || []));
      }
      setAchievements(achs);
    }

    const cRes = await fetch(`/api/checkins?goal_sheet_id=${sheet.id}`);
    const cData = await cRes.json();
    setCheckins(cData.checkins || []);

    const existing = (cData.checkins || []).find((c: Checkin) => c.quarter === quarter);
    if (existing) setComment(existing.comment);

    setDetailOpen(true);
  }

  async function submitCheckin() {
    if (!selectedSheet || !comment.trim()) {
      toast.error("Please enter a check-in comment");
      return;
    }
    if (comment.length < 10) {
      toast.error("Comment must be at least 10 characters");
      return;
    }

    try {
      const res = await fetch("/api/checkins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goal_sheet_id: selectedSheet.id,
          quarter,
          comment,
        }),
      });
      if (res.ok) {
        toast.success("Check-in saved");
        const cRes = await fetch(`/api/checkins?goal_sheet_id=${selectedSheet.id}`);
        const cData = await cRes.json();
        setCheckins(cData.checkins || []);
      } else {
        const err = await res.json();
        toast.error(err.error);
      }
    } catch {
      toast.error("Failed to save check-in");
    }
  }

  function getAchievement(goalId: string, q: Quarter): Achievement | undefined {
    return achievements.find((a) => a.goal_id === goalId && a.quarter === q);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-pulse text-muted-foreground">Loading check-ins...</div>
      </div>
    );
  }

  return (
    <div>
      <Header title="Quarterly Check-ins" />
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <MessageSquare className="h-5 w-5 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Review planned vs. actual for each team member and provide feedback
            </p>
          </div>
          <Select value={quarter} onValueChange={(v) => v && setQuarter(v as Quarter)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Q1">{getQuarterLabel("Q1")}</SelectItem>
              <SelectItem value="Q2">{getQuarterLabel("Q2")}</SelectItem>
              <SelectItem value="Q3">{getQuarterLabel("Q3")}</SelectItem>
              <SelectItem value="Q4">{getQuarterLabel("Q4")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
          <DialogContent className="sm:max-w-5xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                Check-in: {selectedSheet?.employee?.name} - {quarter}
              </DialogTitle>
            </DialogHeader>
            {selectedSheet?.goals && (
              <div className="space-y-4">
                {(() => {
                  const qAchs = achievements.filter((a) => a.quarter === quarter);
                  const overallScore = computeOverallScore(
                    selectedSheet.goals.map((g) => ({ id: g.id, weightage: g.weightage })),
                    qAchs.map((a) => ({ goal_id: a.goal_id, computed_score: a.computed_score }))
                  );
                  return (
                    <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                      <div>
                        <p className="text-sm font-medium">
                          Overall Weighted Score for {getQuarterLabel(quarter)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Based on {qAchs.length} of {selectedSheet.goals.length} goals with achievements
                        </p>
                      </div>
                      <div className={`text-2xl font-bold ${getScoreColor(overallScore)}`}>
                        {overallScore > 0 ? `${overallScore.toFixed(0)}%` : "—"}
                      </div>
                    </div>
                  );
                })()}

                <div className="border rounded-lg overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Goal</TableHead>
                        <TableHead>UoM</TableHead>
                        <TableHead>Target</TableHead>
                        <TableHead>Planned</TableHead>
                        <TableHead>Actual</TableHead>
                        <TableHead>Score</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedSheet.goals.map((goal) => {
                        const ach = getAchievement(goal.id, quarter);
                        return (
                          <TableRow key={goal.id}>
                            <TableCell>
                              <div className="font-medium text-sm">{goal.title}</div>
                              <div className="text-xs text-muted-foreground">
                                W: {goal.weightage}%
                              </div>
                            </TableCell>
                            <TableCell className="text-xs">
                              {getUomLabel(goal.uom_type)}
                            </TableCell>
                            <TableCell>{goal.target_value ?? goal.target_date}</TableCell>
                            <TableCell>
                              {goal.uom_type === "timeline"
                                ? "-"
                                : (ach?.planned_target ?? "-")}
                            </TableCell>
                            <TableCell className="font-medium">
                              {goal.uom_type === "timeline"
                                ? (ach?.completion_date || "-")
                                : (ach?.actual_achievement ?? "-")}
                            </TableCell>
                            <TableCell>
                              {ach?.computed_score != null ? (
                                <span className={getScoreColor(ach.computed_score)}>
                                  {ach.computed_score.toFixed(0)}%
                                </span>
                              ) : (
                                "-"
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary" className="text-xs capitalize">
                                {ach?.progress_status?.replace("_", " ") || "Not Updated"}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                <div className="space-y-2">
                  <Label>Check-in Comment</Label>
                  <Textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Document the check-in discussion, feedback, and action items..."
                    rows={4}
                  />
                  <Button onClick={submitCheckin} className="w-full">
                    <MessageSquare className="h-4 w-4 mr-2" /> Save Check-in
                  </Button>
                </div>

                {checkins.length > 0 && (
                  <div className="border-t pt-4">
                    <h4 className="font-medium text-sm mb-2">Previous Check-ins</h4>
                    <div className="space-y-2">
                      {checkins.map((c) => (
                        <div key={c.id} className="p-3 bg-muted rounded-lg">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline">{c.quarter}</Badge>
                            <span className="text-xs text-muted-foreground">
                              by {c.manager?.name}
                            </span>
                          </div>
                          <p className="text-sm">{c.comment}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              Team Members with Approved Goals
            </CardTitle>
          </CardHeader>
          <CardContent>
            {sheets.length > 0 ? (
              <div className="space-y-2">
                {sheets.map((sheet) => (
                  <div
                    key={sheet.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent transition-colors"
                  >
                    <div>
                      <p className="font-medium">{sheet.employee?.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {sheet.goals?.length} goals
                      </p>
                    </div>
                    <Button size="sm" onClick={() => openCheckin(sheet)}>
                      <Eye className="h-4 w-4 mr-1" /> Check-in
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center py-12 text-muted-foreground">
                No approved goal sheets found. Approve goal sheets first.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
