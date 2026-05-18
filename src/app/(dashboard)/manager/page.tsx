"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { Header } from "@/components/header";
import { StatsCard } from "@/components/stats-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, CheckSquare, Target, ClipboardList, ArrowRight, RefreshCw, AlertTriangle, Clock, Shield } from "lucide-react";
import type { Escalation } from "@/types";

const POLL_INTERVAL = 15000;

export default function ManagerDashboard() {
  const [data, setData] = useState<{
    stats: Record<string, number>;
    activeCycle: { name: string } | null;
    teamSheets: { id: string; status: string; employee: { name: string } }[];
    pendingEscalations: (Escalation & { target_user?: { name: string; role: string } })[];
    teamEscalations: (Escalation & { target_user?: { name: string; role: string } })[];
  }>({ stats: {}, activeCycle: null, teamSheets: [], pendingEscalations: [], teamEscalations: [] });
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
    } catch (err) {
      console.error("Dashboard fetch error:", err);
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
      <div className="flex items-center justify-center h-full">
        <div className="animate-pulse text-muted-foreground">Loading dashboard...</div>
      </div>
    );
  }

  const { stats, activeCycle, teamSheets, pendingEscalations, teamEscalations } = data;

  const ruleLabels: Record<string, string> = {
    goal_not_submitted: "Goal Not Submitted",
    approval_pending: "Approval Pending",
    checkin_missing: "Check-in Missing",
    achievement_not_updated: "Achievement Not Updated",
  };

  const ruleLinks: Record<string, string> = {
    goal_not_submitted: "/manager/team",
    approval_pending: "/manager/approvals",
    checkin_missing: "/manager/checkins",
    achievement_not_updated: "/manager/team",
  };

  return (
    <div>
      <Header title="Manager Dashboard" />
      <div className="p-6 space-y-6">
        {/* Manager's own escalation banners */}
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
                  <Shield
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
                  <Link href={ruleLinks[esc.rule_type] || "/manager/team"}>
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

        {/* Team member escalation alerts */}
        {teamEscalations && teamEscalations.length > 0 && (
          <Card className="border-orange-200 dark:border-orange-900">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2 text-orange-700 dark:text-orange-400">
                <AlertTriangle className="h-4 w-4" />
                Team Member Escalations ({teamEscalations.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {teamEscalations.slice(0, 5).map((esc) => (
                  <div
                    key={esc.id}
                    className="flex items-center justify-between p-2.5 border rounded-lg bg-orange-50/50 dark:bg-orange-950/10"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">
                        {esc.target_user?.name || "Unknown"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {ruleLabels[esc.rule_type] || esc.rule_type}
                        {esc.deadline && (
                          <> &middot; Due: {new Date(esc.deadline).toLocaleDateString()}</>
                        )}
                      </p>
                    </div>
                    <Badge
                      variant="secondary"
                      className={
                        esc.status === "escalated"
                          ? "bg-red-100 text-red-800"
                          : "bg-amber-100 text-amber-800"
                      }
                    >
                      {esc.status}
                    </Badge>
                  </div>
                ))}
                {teamEscalations.length > 5 && (
                  <p className="text-xs text-muted-foreground text-center">
                    +{teamEscalations.length - 5} more
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
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

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatsCard title="Team Size" value={stats.teamSize || 0} icon={Users} />
          <StatsCard
            title="Pending Approvals"
            value={stats.pendingApprovals || 0}
            description="Awaiting your review"
            icon={CheckSquare}
          />
          <StatsCard
            title="Approved"
            value={stats.approvedSheets || 0}
            description="Goals locked"
            icon={Target}
          />
          <StatsCard
            title="Total Sheets"
            value={stats.totalSheets || 0}
            icon={ClipboardList}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Team Goal Sheets</CardTitle>
              <Link href="/manager/team">
                <Button variant="outline" size="sm">
                  View All <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {teamSheets && teamSheets.length > 0 ? (
                <div className="space-y-2">
                  {teamSheets.slice(0, 5).map((sheet) => (
                    <div
                      key={sheet.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <span className="text-sm font-medium">
                        {sheet.employee?.name}
                      </span>
                      <Badge
                        variant="secondary"
                        className={
                          sheet.status === "submitted"
                            ? "bg-yellow-100 text-yellow-800"
                            : sheet.status === "locked" || sheet.status === "approved"
                            ? "bg-green-100 text-green-800"
                            : ""
                        }
                      >
                        {sheet.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No team members assigned yet
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Link href="/manager/approvals" className="block p-3 border rounded-lg hover:bg-accent transition-colors">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-sm">Review Approvals</div>
                    <div className="text-xs text-muted-foreground">
                      {stats.pendingApprovals || 0} pending
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </Link>
              <Link href="/manager/checkins" className="block p-3 border rounded-lg hover:bg-accent transition-colors">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-sm">Quarterly Check-ins</div>
                    <div className="text-xs text-muted-foreground">Conduct team check-ins</div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </Link>
              <Link href="/manager/goals" className="block p-3 border rounded-lg hover:bg-accent transition-colors">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-sm">My Goals</div>
                    <div className="text-xs text-muted-foreground">Manage your own goals</div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
