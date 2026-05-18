"use client";

import { useEffect, useState, useCallback } from "react";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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
  Download,
  FileSpreadsheet,
  FileText,
  RefreshCw,
  Users,
  CheckCircle2,
  XCircle,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import type { Cycle } from "@/types";

interface CheckinCompletion {
  employeeId: string;
  employeeName: string;
  department: string;
  managerName: string;
  sheetId: string;
  sheetStatus: string;
  quarters: Record<string, { done: boolean; managerName?: string; date?: string }>;
}

export default function ReportsPage() {
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [selectedCycle, setSelectedCycle] = useState<string>("");
  const [completionData, setCompletionData] = useState<CheckinCompletion[]>([]);
  const [completionStats, setCompletionStats] = useState({
    totalSheets: 0,
    approvedSheets: 0,
    pendingApproval: 0,
    totalExpectedCheckins: 0,
    completedCheckins: 0,
  });
  const [downloading, setDownloading] = useState(false);
  const [loadingCompletion, setLoadingCompletion] = useState(false);

  useEffect(() => {
    fetch("/api/cycles")
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load cycles");
        return r.json();
      })
      .then((d) => {
        setCycles(d.cycles || []);
        const active = d.cycles?.find((c: Cycle) => c.status === "active");
        if (active) setSelectedCycle(active.id);
      })
      .catch(() => toast.error("Failed to load cycles"));
  }, []);

  const fetchCompletionData = useCallback(async () => {
    if (!selectedCycle) return;
    setLoadingCompletion(true);
    try {
      const res = await fetch(`/api/reports/completion?cycle_id=${selectedCycle}`);
      if (!res.ok) {
        toast.error("Failed to load completion data");
        return;
      }
      const d = await res.json();
      setCompletionData(d.completionGrid || []);
      setCompletionStats(d.stats || {
        totalSheets: 0,
        approvedSheets: 0,
        pendingApproval: 0,
        totalExpectedCheckins: 0,
        completedCheckins: 0,
      });
    } catch {
      toast.error("Failed to load completion data");
    } finally {
      setLoadingCompletion(false);
    }
  }, [selectedCycle]);

  useEffect(() => {
    fetchCompletionData();
  }, [fetchCompletionData]);

  async function downloadReport(format: "xlsx" | "csv") {
    if (!selectedCycle) {
      toast.error("Please select a cycle first");
      return;
    }
    setDownloading(true);
    try {
      const url = `/api/reports/export?cycle_id=${selectedCycle}&format=${format}`;
      const res = await fetch(url);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "No data to export" }));
        toast.error(err.error || "Failed to generate report");
        return;
      }
      const blob = await res.blob();
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `achievement_report.${format}`;
      link.click();
      URL.revokeObjectURL(link.href);
      toast.success(`${format.toUpperCase()} report downloaded`);
    } catch {
      toast.error("Download failed");
    } finally {
      setDownloading(false);
    }
  }

  const checkinRate = completionStats.totalExpectedCheckins > 0
    ? Math.round((completionStats.completedCheckins / completionStats.totalExpectedCheckins) * 100)
    : 0;
  const sheetRate = completionStats.totalSheets > 0
    ? Math.round((completionStats.approvedSheets / completionStats.totalSheets) * 100)
    : 0;

  return (
    <div>
      <Header title="Reports & Exports" />
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Select
            value={selectedCycle}
            onValueChange={(v) => v && setSelectedCycle(v)}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Select cycle" />
            </SelectTrigger>
            <SelectContent>
              {cycles.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="ghost" size="sm" onClick={fetchCompletionData}>
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Achievement Report Export */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Download className="h-5 w-5" />
              Achievement Report
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Exportable report showing Planned Target vs. Actual Achievement for all
              employees, including Q1-Q4 data with computed scores, progress status,
              and completion dates for timeline goals.
            </p>
            <div className="p-3 rounded-lg bg-muted/50 border border-dashed">
              <p className="text-xs font-medium mb-2">Report columns:</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                <ul className="text-xs text-muted-foreground space-y-0.5">
                  <li>Employee name, department, designation</li>
                  <li>Thrust area, goal title, UoM type</li>
                  <li>Target value / date, weightage %</li>
                </ul>
                <ul className="text-xs text-muted-foreground space-y-0.5">
                  <li>Q1-Q4 Planned Target values</li>
                  <li>Q1-Q4 Actual Achievement / Completion Date</li>
                  <li>Q1-Q4 Computed Scores and Status</li>
                </ul>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => downloadReport("xlsx")}
                className="flex-1"
                disabled={downloading || !selectedCycle}
              >
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                {downloading ? "Generating..." : "Download Excel (.xlsx)"}
              </Button>
              <Button
                variant="outline"
                onClick={() => downloadReport("csv")}
                className="flex-1"
                disabled={downloading || !selectedCycle}
              >
                <FileText className="h-4 w-4 mr-2" />
                Download CSV
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Completion Dashboard */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5" />
              Completion Dashboard
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-sm text-muted-foreground">
              Real-time view of which employees and managers have completed quarterly
              check-ins for the selected cycle.
            </p>

            {/* Summary stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Goal Sheets</p>
                <p className="text-2xl font-bold">{completionStats.totalSheets}</p>
                <div className="flex items-center gap-1">
                  <Progress value={sheetRate} className="h-1.5 flex-1" />
                  <span className="text-xs font-medium">{sheetRate}%</span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {completionStats.approvedSheets} approved / locked
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Pending Approval</p>
                <p className="text-2xl font-bold text-amber-600">{completionStats.pendingApproval}</p>
                <p className="text-[11px] text-muted-foreground">sheets awaiting review</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Check-ins Done</p>
                <p className="text-2xl font-bold text-green-600">{completionStats.completedCheckins}</p>
                <div className="flex items-center gap-1">
                  <Progress value={checkinRate} className="h-1.5 flex-1" />
                  <span className="text-xs font-medium">{checkinRate}%</span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  of {completionStats.totalExpectedCheckins} expected
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Check-in Rate</p>
                <p className="text-2xl font-bold">{checkinRate}%</p>
                <p className="text-[11px] text-muted-foreground">
                  across all quarters
                </p>
              </div>
            </div>

            {/* Check-in completion grid */}
            {loadingCompletion ? (
              <div className="animate-pulse text-muted-foreground text-sm py-8 text-center">
                Loading completion data...
              </div>
            ) : completionData.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                No goal sheets found for this cycle
              </div>
            ) : (
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Manager</TableHead>
                      <TableHead>Sheet Status</TableHead>
                      <TableHead className="text-center">Q1</TableHead>
                      <TableHead className="text-center">Q2</TableHead>
                      <TableHead className="text-center">Q3</TableHead>
                      <TableHead className="text-center">Q4</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {completionData.map((row) => (
                      <TableRow key={row.sheetId}>
                        <TableCell className="font-medium text-sm">
                          {row.employeeName}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {row.department}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {row.managerName || "—"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className={
                              row.sheetStatus === "locked" || row.sheetStatus === "approved"
                                ? "bg-green-100 text-green-800"
                                : row.sheetStatus === "submitted"
                                ? "bg-yellow-100 text-yellow-800"
                                : row.sheetStatus === "rejected"
                                ? "bg-red-100 text-red-800"
                                : ""
                            }
                          >
                            {row.sheetStatus}
                          </Badge>
                        </TableCell>
                        {(["Q1", "Q2", "Q3", "Q4"] as const).map((q) => {
                          const checkin = row.quarters[q];
                          return (
                            <TableCell key={q} className="text-center">
                              {checkin?.done ? (
                                <div className="flex flex-col items-center">
                                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                                  {checkin.date && (
                                    <span className="text-[10px] text-muted-foreground mt-0.5">
                                      {new Date(checkin.date).toLocaleDateString("en-IN", {
                                        day: "2-digit",
                                        month: "short",
                                      })}
                                    </span>
                                  )}
                                </div>
                              ) : checkin === undefined ? (
                                <Clock className="h-5 w-5 text-muted-foreground/30 mx-auto" />
                              ) : (
                                <XCircle className="h-5 w-5 text-red-400 mx-auto" />
                              )}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
