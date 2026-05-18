"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { Header } from "@/components/header";
import { StatsCard } from "@/components/stats-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Target, TrendingUp, CheckSquare, ArrowRight, RefreshCw, AlertTriangle, Clock } from "lucide-react";
import { getStatusColor } from "@/lib/utils/score-calculator";
import type { Escalation, Goal } from "@/types";

const POLL_INTERVAL = 20000;

export default function EmployeeDashboard() {
  const [data, setData] = useState<{
    stats: Record<string, number | string>;
    goalSheet: { id: string; status: string; goals: Goal[] } | null;
    activeCycle: { id: string; name: string } | null;
    pendingEscalations: Escalation[];
  }>({ stats: {}, goalSheet: null, activeCycle: null, pendingEscalations: [] });
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchDashboard = useCallback(async (showLoader = false) => {
    if (showLoader) setLoading(true);
    try {
      const res = await fetch("/api/dashboard");
      if (res.ok) {
        const d = await res.json();
        setData(d);
        setLastUpdated(new Date());
      }
    } catch {
      // silently handle fetch errors
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard(true);
    intervalRef.current = setInterval(() => {
      if (document.visibilityState === "visible") fetchDashboard(false);
    }, POLL_INTERVAL);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchDashboard]);

  if (loading && !lastUpdated) {
    return (
      <div>
        <Header title="Employee Dashboard" />
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-8 w-24" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-4 rounded" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-16 mb-1" />
                  <Skeleton className="h-3 w-32" />
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {Array.from({ length: 2 }).map((_, i) => (
              <Card key={i}>
                <CardHeader><Skeleton className="h-5 w-32" /></CardHeader>
                <CardContent className="space-y-3">
                  {Array.from({ length: 3 }).map((_, j) => (
                    <Skeleton key={j} className="h-14 w-full rounded-lg" />
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const { stats, goalSheet, activeCycle, pendingEscalations } = data;
  const totalWeightage = Number(stats.totalWeightage) || 0;

  const ruleLabels: Record<string, string> = {
    goal_not_submitted: "Goal Not Submitted",
    approval_pending: "Approval Pending",
    checkin_missing: "Check-in Missing",
    achievement_not_updated: "Achievement Not Updated",
  };

  const ruleLinks: Record<string, string> = {
    goal_not_submitted: "/employee/goals",
    approval_pending: "/employee/goals",
    checkin_missing: "/employee/goals",
    achievement_not_updated: "/employee/achievements",
  };

  return (
    <div>
      <Header title="Employee Dashboard" />
      <div className="p-6 space-y-6">
        {/* Escalation Reminder Banners */}
        {pendingEscalations && pendingEscalations.length > 0 && (
          <div className="space-y-3">
            {pendingEscalations.map((esc) => {
              const deadlinePassed = esc.deadline && new Date(esc.deadline) < new Date();
              return (
                <div
                  key={esc.id}
                  className={`flex items-start gap-3 rounded-lg border p-4 ${
                    deadlinePassed
                      ? "border-red-300 bg-red-50 dark:bg-red-950/20"
                      : "border-amber-300 bg-amber-50 dark:bg-amber-950/20"
                  }`}
                >
                  <AlertTriangle
                    className={`h-5 w-5 mt-0.5 flex-shrink-0 ${
                      deadlinePassed ? "text-red-600" : "text-amber-600"
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">
                      Action Required: {ruleLabels[esc.rule_type] || esc.rule_type}
                    </p>
                    {esc.message && (
                      <p className="text-sm text-muted-foreground mt-0.5">{esc.message}</p>
                    )}
                    <div className="flex items-center gap-3 mt-1">
                      {esc.deadline && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          Deadline: {new Date(esc.deadline).toLocaleDateString()}
                          {deadlinePassed && (
                            <Badge variant="secondary" className="ml-1 bg-red-100 text-red-800 text-[10px]">
                              Overdue
                            </Badge>
                          )}
                        </span>
                      )}
                      <Badge
                        variant="outline"
                        className={
                          esc.status === "escalated"
                            ? "border-red-300 text-red-700"
                            : "border-amber-300 text-amber-700"
                        }
                      >
                        {esc.status === "escalated" ? "Re-escalated" : "Pending"}
                      </Badge>
                    </div>
                  </div>
                  <Link href={ruleLinks[esc.rule_type] || "/employee/goals"}>
                    <Button size="sm" variant={deadlinePassed ? "destructive" : "default"}>
                      Take Action
                      <ArrowRight className="h-3.5 w-3.5 ml-1" />
                    </Button>
                  </Link>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {activeCycle && (
              <>
                <span className="text-sm text-muted-foreground">Active Cycle:</span>
                <Badge variant="outline">{activeCycle.name}</Badge>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            {lastUpdated && (
              <span className="text-xs text-muted-foreground">
                Updated {lastUpdated.toLocaleTimeString()}
              </span>
            )}
            <Button variant="ghost" size="sm" onClick={() => fetchDashboard(false)}>
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatsCard
            title="My Goals"
            value={stats.totalGoals || 0}
            description="Goals in current cycle"
            icon={Target}
          />
          <StatsCard
            title="Weightage"
            value={`${totalWeightage}%`}
            description={totalWeightage === 100 ? "Complete" : `${100 - totalWeightage}% remaining`}
            icon={TrendingUp}
          />
          <StatsCard
            title="Sheet Status"
            value={String(stats.sheetStatus || "Not Created").replace("_", " ")}
            description="Goal sheet status"
            icon={CheckSquare}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">My Goal Sheet</CardTitle>
              <Link href="/employee/goals">
                <Button size="sm">
                  {goalSheet ? "View Goals" : "Create Goals"}
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {goalSheet?.goals && goalSheet.goals.length > 0 ? (
                <div className="space-y-3">
                  {goalSheet.goals.slice(0, 4).map((goal) => (
                    <div
                      key={goal.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{goal.title}</p>
                        <p className="text-xs text-muted-foreground">
                          Weightage: {goal.weightage}%
                        </p>
                      </div>
                      <Badge className={getStatusColor(goal.status)} variant="secondary">
                        {goal.status}
                      </Badge>
                    </div>
                  ))}
                  {goalSheet.goals.length > 4 && (
                    <p className="text-xs text-muted-foreground text-center">
                      +{goalSheet.goals.length - 4} more goals
                    </p>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Target className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No goals created yet</p>
                  <p className="text-xs">Start by creating your goal sheet</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Weightage Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span>Total Allocated</span>
                  <span className="font-medium">{totalWeightage}%</span>
                </div>
                <Progress value={totalWeightage} className="h-3" />
                <p className="text-xs text-muted-foreground">
                  {totalWeightage === 100
                    ? "Perfect! Total weightage equals 100%"
                    : totalWeightage > 100
                    ? `Over by ${totalWeightage - 100}%. Reduce weightage.`
                    : `Remaining: ${100 - totalWeightage}%. Add more weightage.`}
                </p>

                {goalSheet?.goals && goalSheet.goals.length > 0 && (
                  <div className="space-y-2 pt-4 border-t">
                    {goalSheet.goals.map((goal) => (
                      <div key={goal.id} className="flex items-center gap-2">
                        <div className="flex-1">
                          <div className="text-xs truncate">{goal.title}</div>
                          <Progress value={goal.weightage} className="h-1.5 mt-1" />
                        </div>
                        <span className="text-xs font-medium w-10 text-right">
                          {goal.weightage}%
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
