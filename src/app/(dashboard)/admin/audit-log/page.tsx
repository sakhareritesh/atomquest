"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Header } from "@/components/header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  RefreshCw,
  Filter,
  Search,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  FileText,
  Eye,
  History,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { formatDateTime } from "@/lib/utils/date-utils";
import type { AuditLog } from "@/types";

const PAGE_SIZE = 50;
const POLL_INTERVAL = 15000;

const ACTION_COLORS: Record<string, string> = {
  approve: "bg-green-100 text-green-800",
  reject: "bg-red-100 text-red-800",
  unlock: "bg-yellow-100 text-yellow-800",
  update: "bg-blue-100 text-blue-800",
  create: "bg-purple-100 text-purple-800",
  role_change: "bg-orange-100 text-orange-800",
  hierarchy_change: "bg-cyan-100 text-cyan-800",
  admin_delete: "bg-red-100 text-red-800",
  resolve: "bg-green-100 text-green-800",
};

const ENTITY_TYPES = [
  { value: "all", label: "All Entities" },
  { value: "goal", label: "Goal" },
  { value: "goal_sheet", label: "Goal Sheet" },
  { value: "achievement", label: "Achievement" },
  { value: "checkin", label: "Check-in" },
  { value: "cycle", label: "Cycle" },
  { value: "user", label: "User" },
  { value: "escalation", label: "Escalation" },
];

const ACTION_TYPES = [
  { value: "all", label: "All Actions" },
  { value: "update", label: "Update" },
  { value: "create", label: "Create" },
  { value: "approve", label: "Approve" },
  { value: "reject", label: "Reject" },
  { value: "unlock", label: "Unlock" },
  { value: "admin_delete", label: "Admin Delete" },
  { value: "role_change", label: "Role Change" },
  { value: "hierarchy_change", label: "Hierarchy Change" },
  { value: "resolve", label: "Resolve" },
];

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [entityFilter, setEntityFilter] = useState("all");
  const [actionFilter, setActionFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [downloading, setDownloading] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce search
  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(0);
    }, 400);
    return () => {
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
    };
  }, [searchTerm]);

  const fetchLogs = useCallback(
    async (showLoader = false) => {
      if (showLoader) setLoading(true);
      try {
        const params = new URLSearchParams({
          limit: String(PAGE_SIZE),
          offset: String(page * PAGE_SIZE),
        });
        if (entityFilter !== "all") params.set("entity_type", entityFilter);
        if (actionFilter !== "all") params.set("action", actionFilter);
        if (debouncedSearch) params.set("search", debouncedSearch);
        if (dateFrom) params.set("date_from", dateFrom);
        if (dateTo) params.set("date_to", dateTo);

        const res = await fetch(`/api/audit-logs?${params.toString()}`);
        if (!res.ok) {
          toast.error("Failed to load audit logs");
          return;
        }
        const d = await res.json();
        setLogs(d.auditLogs || []);
        setTotal(d.total || 0);
        setLastUpdated(new Date());
      } catch {
        toast.error("Failed to load audit logs");
      } finally {
        setLoading(false);
      }
    },
    [entityFilter, actionFilter, debouncedSearch, dateFrom, dateTo, page]
  );

  useEffect(() => {
    fetchLogs(true);
    intervalRef.current = setInterval(() => {
      if (document.visibilityState === "visible") fetchLogs(false);
    }, POLL_INTERVAL);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchLogs]);

  // Reset page when filters change
  useEffect(() => {
    setPage(0);
  }, [entityFilter, actionFilter, dateFrom, dateTo]);

  async function downloadAudit(format: "xlsx" | "csv") {
    setDownloading(true);
    try {
      const params = new URLSearchParams({ type: "audit", format });
      if (entityFilter !== "all") params.set("entity_type", entityFilter);
      if (actionFilter !== "all") params.set("action", actionFilter);

      const res = await fetch(`/api/reports/export?${params.toString()}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Export failed" }));
        toast.error(err.error || "Export failed");
        return;
      }
      const blob = await res.blob();
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `audit_trail.${format}`;
      link.click();
      URL.revokeObjectURL(link.href);
      toast.success(`Audit trail exported as ${format.toUpperCase()}`);
    } catch {
      toast.error("Export failed");
    } finally {
      setDownloading(false);
    }
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const hasFilters =
    entityFilter !== "all" || actionFilter !== "all" || debouncedSearch || dateFrom || dateTo;

  return (
    <div>
      <Header title="Audit Trail" />
      <div className="p-6 space-y-6">
        {/* Header row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              All changes to goals, achievements, check-ins, approvals, and system
              actions are logged here. Post-lock changes are captured automatically.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {lastUpdated && (
              <span className="text-xs text-muted-foreground">
                Updated {lastUpdated.toLocaleTimeString()}
              </span>
            )}
            <Button variant="ghost" size="sm" onClick={() => fetchLogs(false)}>
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Filters + Search + Export */}
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex flex-wrap items-center gap-3">
              <Filter className="h-4 w-4 text-muted-foreground flex-shrink-0" />

              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search fields, values..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-[220px] pl-8 h-9"
                />
              </div>

              <Select
                value={entityFilter}
                onValueChange={(v) => v && setEntityFilter(v)}
              >
                <SelectTrigger className="w-[160px] h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ENTITY_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={actionFilter}
                onValueChange={(v) => v && setActionFilter(v)}
              >
                <SelectTrigger className="w-[160px] h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACTION_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-[140px] h-9"
                placeholder="From"
              />
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-[140px] h-9"
                placeholder="To"
              />

              {hasFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9"
                  onClick={() => {
                    setEntityFilter("all");
                    setActionFilter("all");
                    setSearchTerm("");
                    setDebouncedSearch("");
                    setDateFrom("");
                    setDateTo("");
                  }}
                >
                  Clear
                </Button>
              )}

              <div className="ml-auto flex gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9"
                  onClick={() => downloadAudit("xlsx")}
                  disabled={downloading}
                >
                  <FileSpreadsheet className="h-3.5 w-3.5 mr-1" />
                  Excel
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9"
                  onClick={() => downloadAudit("csv")}
                  disabled={downloading}
                >
                  <FileText className="h-3.5 w-3.5 mr-1" />
                  CSV
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Results count and pagination info */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {total > 0
              ? `Showing ${page * PAGE_SIZE + 1}–${Math.min((page + 1) * PAGE_SIZE, total)} of ${total} entries`
              : "No entries found"}
          </p>
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm">
                Page {page + 1} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        {/* Audit log table */}
        {loading && !lastUpdated ? (
          <div className="border rounded-lg p-4 space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-4 w-[140px]" />
                <Skeleton className="h-4 w-[100px]" />
                <Skeleton className="h-5 w-[80px] rounded-full" />
                <Skeleton className="h-5 w-[70px] rounded-full" />
                <Skeleton className="h-4 w-[80px]" />
                <Skeleton className="h-4 w-[100px]" />
                <Skeleton className="h-4 w-[100px]" />
              </div>
            ))}
          </div>
        ) : (
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[170px]">Timestamp</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Field</TableHead>
                  <TableHead>Old Value</TableHead>
                  <TableHead>New Value</TableHead>
                  <TableHead className="w-[50px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow
                    key={log.id}
                    className="cursor-pointer hover:bg-accent/50"
                    onClick={() => setSelectedLog(log)}
                  >
                    <TableCell className="text-xs whitespace-nowrap">
                      {formatDateTime(log.created_at)}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm font-medium">
                        {log.user?.name || "System"}
                      </div>
                      {log.user?.role && (
                        <div className="text-[11px] text-muted-foreground capitalize">
                          {log.user.role}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {log.entity_type.replace("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={ACTION_COLORS[log.action] || "bg-gray-100 text-gray-800"}
                      >
                        {log.action.replace("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{log.field_changed || "—"}</TableCell>
                    <TableCell className="text-sm max-w-[150px]">
                      <span className="text-red-600 truncate block">
                        {log.old_value || "—"}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm max-w-[150px]">
                      <span className="text-green-600 truncate block">
                        {log.new_value || "—"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedLog(log);
                        }}
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {logs.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="text-center py-12 text-muted-foreground"
                    >
                      <History className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      <p>No audit logs found</p>
                      <p className="text-xs mt-1">
                        Changes to goals after lock, approvals, rejections, role
                        changes, achievement updates, and check-ins will appear here.
                      </p>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Bottom pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="h-4 w-4 mr-1" /> Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
            >
              Next <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        )}

        {/* Detail Dialog */}
        <Dialog
          open={!!selectedLog}
          onOpenChange={(open) => !open && setSelectedLog(null)}
        >
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Audit Log Detail
              </DialogTitle>
            </DialogHeader>
            {selectedLog && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Timestamp
                    </p>
                    <p className="text-sm mt-1">
                      {formatDateTime(selectedLog.created_at)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Changed By
                    </p>
                    <p className="text-sm mt-1">
                      {selectedLog.user?.name || "System"}
                      {selectedLog.user?.role && (
                        <span className="text-muted-foreground capitalize">
                          {" "}
                          ({selectedLog.user.role})
                        </span>
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Entity Type
                    </p>
                    <Badge variant="outline" className="capitalize mt-1">
                      {selectedLog.entity_type.replace("_", " ")}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Action
                    </p>
                    <Badge
                      className={`mt-1 ${
                        ACTION_COLORS[selectedLog.action] || "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {selectedLog.action.replace("_", " ")}
                    </Badge>
                  </div>
                </div>

                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Entity ID
                  </p>
                  <p className="text-xs font-mono mt-1 text-muted-foreground">
                    {selectedLog.entity_id}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Field Changed
                  </p>
                  <p className="text-sm mt-1">
                    {selectedLog.field_changed || "—"}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Old Value
                    </p>
                    <div className="mt-1 p-2 rounded border bg-red-50 dark:bg-red-950/20 min-h-[40px]">
                      <p className="text-sm text-red-700 dark:text-red-400 break-all whitespace-pre-wrap">
                        {selectedLog.old_value || "—"}
                      </p>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      New Value
                    </p>
                    <div className="mt-1 p-2 rounded border bg-green-50 dark:bg-green-950/20 min-h-[40px]">
                      <p className="text-sm text-green-700 dark:text-green-400 break-all whitespace-pre-wrap">
                        {selectedLog.new_value || "—"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
