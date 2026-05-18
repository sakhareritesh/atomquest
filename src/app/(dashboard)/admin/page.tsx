"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { Header } from "@/components/header";
import { StatsCard } from "@/components/stats-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Target, CheckSquare, Calendar, BarChart3, FileText, RefreshCw, ArrowRight, AlertTriangle, Radar } from "lucide-react";

const POLL_INTERVAL = 15000;

export default function AdminDashboard() {
  const [data, setData] = useState<{
    stats: Record<string, number>;
    activeCycle: { name: string; status: string } | null;
  }>({ stats: {}, activeCycle: null });
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
        <Header title="Admin Dashboard" />
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-8 w-24" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
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
                  {Array.from({ length: 4 }).map((_, j) => (
                    <Skeleton key={j} className="h-16 w-full rounded-lg" />
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const { stats, activeCycle } = data;

  return (
    <div>
      <Header title="Admin Dashboard" />
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {activeCycle && (
              <>
                <span className="text-sm text-muted-foreground">Active Cycle:</span>
                <Badge variant="outline">{activeCycle.name}</Badge>
                <Badge className="capitalize">{activeCycle.status}</Badge>
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

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard
            title="Total Users"
            value={stats.totalUsers || 0}
            description={`${stats.employees || 0} employees, ${stats.managers || 0} managers`}
            icon={Users}
          />
          <StatsCard
            title="Goal Sheets"
            value={stats.totalSheets || 0}
            description="Across current cycle"
            icon={Target}
          />
          <StatsCard
            title="Pending Approvals"
            value={stats.pendingApprovals || 0}
            description="Awaiting manager review"
            icon={CheckSquare}
          />
          <StatsCard
            title="Approved Sheets"
            value={stats.approvedSheets || 0}
            description="Goals locked and active"
            icon={BarChart3}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-primary/5 to-transparent">
              <CardTitle className="text-lg flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Calendar className="h-4 w-4 text-primary" />
                </div>
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 pt-4">
              <Link href="/admin/cycles" className="group block p-3 border-l-4 border-l-primary/30 rounded-lg hover:bg-accent hover:border-l-primary hover:-translate-y-0.5 hover:shadow-sm transition-all duration-200">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-sm group-hover:text-primary transition-colors">Manage Cycles</div>
                    <div className="text-xs text-muted-foreground">Create and configure goal cycles</div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                </div>
              </Link>
              <Link href="/admin/users" className="group block p-3 border-l-4 border-l-blue-300/50 rounded-lg hover:bg-accent hover:border-l-blue-500 hover:-translate-y-0.5 hover:shadow-sm transition-all duration-200">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-sm group-hover:text-blue-600 transition-colors">Manage Users</div>
                    <div className="text-xs text-muted-foreground">Update roles and reporting hierarchy</div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all" />
                </div>
              </Link>
              <Link href="/admin/thrust-areas" className="group block p-3 border-l-4 border-l-violet-300/50 rounded-lg hover:bg-accent hover:border-l-violet-500 hover:-translate-y-0.5 hover:shadow-sm transition-all duration-200">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-sm group-hover:text-violet-600 transition-colors">Thrust Areas</div>
                    <div className="text-xs text-muted-foreground">Configure goal categories</div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-violet-600 group-hover:translate-x-0.5 transition-all" />
                </div>
              </Link>
              <Link href="/admin/shared-goals" className="group block p-3 border-l-4 border-l-amber-300/50 rounded-lg hover:bg-accent hover:border-l-amber-500 hover:-translate-y-0.5 hover:shadow-sm transition-all duration-200">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-sm group-hover:text-amber-600 transition-colors">Shared Goals</div>
                    <div className="text-xs text-muted-foreground">Push departmental KPIs to employees</div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-amber-600 group-hover:translate-x-0.5 transition-all" />
                </div>
              </Link>
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-primary/5 to-transparent">
              <CardTitle className="text-lg flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <FileText className="h-4 w-4 text-primary" />
                </div>
                Reports & Monitoring
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 pt-4">
              <Link href="/admin/reports" className="group block p-3 border-l-4 border-l-emerald-300/50 rounded-lg hover:bg-accent hover:border-l-emerald-500 hover:-translate-y-0.5 hover:shadow-sm transition-all duration-200">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-sm group-hover:text-emerald-600 transition-colors">Achievement Report</div>
                    <div className="text-xs text-muted-foreground">Export planned vs actual (Excel/CSV)</div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-emerald-600 group-hover:translate-x-0.5 transition-all" />
                </div>
              </Link>
              <Link href="/admin/audit-log" className="group block p-3 border-l-4 border-l-slate-300/50 rounded-lg hover:bg-accent hover:border-l-slate-500 hover:-translate-y-0.5 hover:shadow-sm transition-all duration-200">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-sm group-hover:text-slate-700 transition-colors">Audit Trail</div>
                    <div className="text-xs text-muted-foreground">View all goal modifications & actions</div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-slate-700 group-hover:translate-x-0.5 transition-all" />
                </div>
              </Link>
              <Link href="/admin/analytics" className="group block p-3 border-l-4 border-l-primary/30 rounded-lg hover:bg-accent hover:border-l-primary hover:-translate-y-0.5 hover:shadow-sm transition-all duration-200">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-sm group-hover:text-primary transition-colors">Analytics</div>
                    <div className="text-xs text-muted-foreground">QoQ trends, charts, and insights</div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                </div>
              </Link>
              <Link href="/admin/escalations" className="group block p-3 border-l-4 border-l-red-300/50 rounded-lg hover:bg-accent hover:border-l-red-500 hover:-translate-y-0.5 hover:shadow-sm transition-all duration-200">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-sm flex items-center gap-2 group-hover:text-red-600 transition-colors">
                      Escalations
                      {((stats.pendingEscalations || 0) > 0 || (stats.detectedViolations || 0) > 0) && (
                        <span className="flex gap-1">
                          {(stats.detectedViolations || 0) > 0 && (
                            <Badge variant="secondary" className="bg-blue-100 text-blue-800 text-[10px] px-1.5 py-0">
                              <Radar className="h-3 w-3 mr-0.5" />
                              {stats.detectedViolations}
                            </Badge>
                          )}
                          {(stats.pendingEscalations || 0) > 0 && (
                            <Badge variant="secondary" className="bg-amber-100 text-amber-800 text-[10px] px-1.5 py-0">
                              <AlertTriangle className="h-3 w-3 mr-0.5" />
                              {stats.pendingEscalations}
                            </Badge>
                          )}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Auto-detect violations & track escalations
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-red-600 group-hover:translate-x-0.5 transition-all" />
                </div>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
