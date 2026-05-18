"use client";

import { useEffect, useState, useCallback } from "react";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Plus, Send, CheckCircle, Users, Eye, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { useAuthStore } from "@/hooks/use-auth";
import { getUomLabel } from "@/lib/utils/score-calculator";
import type { User, Cycle, ThrustArea, UomType } from "@/types";

interface LinkedGoal {
  id: string;
  employee_id: string;
  employee_name: string;
  department: string;
  weightage: number;
  status: string;
}

interface SharedKpi {
  id: string;
  title: string;
  description: string;
  uom_type: UomType;
  target_value: number | null;
  target_date: string | null;
  thrust_area?: { name: string };
  created_at: string;
  linked_goals: LinkedGoal[];
}

export default function ManagerSharedGoalsPage() {
  const { user } = useAuthStore();
  const [teamMembers, setTeamMembers] = useState<User[]>([]);
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [thrustAreas, setThrustAreas] = useState<ThrustArea[]>([]);
  const [activeCycleId, setActiveCycleId] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [sharedKpis, setSharedKpis] = useState<SharedKpi[]>([]);
  const [result, setResult] = useState<{ count: number; skipped: string[]; lockedSkipped: string[] } | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [expandedKpis, setExpandedKpis] = useState<Set<string>>(new Set());

  const [form, setForm] = useState({
    thrust_area_id: "",
    title: "",
    description: "",
    uom_type: "min_numeric" as UomType,
    target_value: "",
    target_date: "",
  });

  const needsTarget = form.uom_type === "min_numeric" || form.uom_type === "max_numeric" || form.uom_type === "zero";
  const needsDate = form.uom_type === "timeline";

  const fetchData = useCallback(async () => {
    if (!user) return;
    try {
      const [cyclesRes, teamRes, taRes] = await Promise.all([
        fetch("/api/cycles"),
        fetch(`/api/users?manager_id=${user.id}`),
        fetch("/api/thrust-areas"),
      ]);
      const cyclesData = await cyclesRes.json();
      const teamData = await teamRes.json();
      const taData = await taRes.json();

      setCycles(cyclesData.cycles || []);
      const team = (teamData.users || []).filter((u: User) => u.id !== user.id);
      setTeamMembers(team);
      setThrustAreas((taData.thrustAreas || []).filter((t: ThrustArea) => t.is_active));

      const active = (cyclesData.cycles || []).find((c: Cycle) => c.status === "active");
      if (active) {
        setActiveCycleId(active.id);
        await fetchSharedKpis(active.id);
      }
    } catch {
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [user]);

  async function fetchSharedKpis(cycleId: string) {
    try {
      const res = await fetch(`/api/shared-goals?cycle_id=${cycleId}`);
      if (!res.ok) {
        toast.error("Failed to load shared KPIs history");
        return;
      }
      const data = await res.json();
      setSharedKpis(data.sharedKpis || []);
    } catch {
      toast.error("Failed to load shared KPIs history");
    }
  }

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function toggleMember(memberId: string) {
    setSelectedMembers((prev) =>
      prev.includes(memberId)
        ? prev.filter((id) => id !== memberId)
        : [...prev, memberId]
    );
  }

  function toggleAll() {
    if (selectedMembers.length === teamMembers.length) {
      setSelectedMembers([]);
    } else {
      setSelectedMembers(teamMembers.map((m) => m.id));
    }
  }

  function resetForm() {
    setForm({
      thrust_area_id: "",
      title: "",
      description: "",
      uom_type: "min_numeric",
      target_value: "",
      target_date: "",
    });
    setSelectedMembers([]);
    setFieldErrors({});
  }

  async function handleCreateKpi(e: React.FormEvent) {
    e.preventDefault();
    setFieldErrors({});
    setResult(null);

    if (!activeCycleId) {
      toast.error("No active cycle found");
      return;
    }
    if (selectedMembers.length === 0) {
      toast.error("Select at least one team member");
      return;
    }

    const errors: Record<string, string> = {};
    if (!form.thrust_area_id) errors.thrust_area_id = "Thrust area is required";
    if (!form.title || form.title.length < 3) errors.title = "Title must be at least 3 characters";
    if (needsTarget && !form.target_value) errors.target_value = "Target value is required";
    if (needsDate && !form.target_date) errors.target_date = "Target date is required";

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/shared-goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          thrust_area_id: form.thrust_area_id,
          title: form.title,
          description: form.description || "",
          uom_type: form.uom_type,
          target_value: form.target_value ? parseFloat(form.target_value) : null,
          target_date: form.target_date || null,
          cycle_id: activeCycleId,
          employee_ids: selectedMembers,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setResult({ count: data.count, skipped: data.skipped || [], lockedSkipped: data.lockedSkipped || [] });
        if (data.count > 0) {
          toast.success(`KPI assigned to ${data.count} team member(s)`);
        }
        if (data.skippedCount > 0) {
          toast.info(`${data.skippedCount} member(s) already had this goal`);
        }
        if (data.lockedSkippedCount > 0) {
          toast.warning(`${data.lockedSkippedCount} member(s) skipped (sheet locked/full)`);
        }
        resetForm();
        await fetchSharedKpis(activeCycleId);
      } else {
        toast.error(data.error || "Failed to create KPI");
      }
    } catch {
      toast.error("Failed to create KPI");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div>
      <Header title="Shared Goals" />
      <div className="p-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Plus className="h-5 w-5" /> Create KPI
            </CardTitle>
            <CardDescription>
              Create a departmental KPI and assign it to your team members.
              The goal title and target will be read-only for employees — they can only adjust the weightage.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateKpi} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Thrust Area <span className="text-destructive">*</span></Label>
                  <Select
                    value={form.thrust_area_id}
                    onValueChange={(v) => v && setForm({ ...form, thrust_area_id: v })}
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
                  <Label>UoM Type <span className="text-destructive">*</span></Label>
                  <Select
                    value={form.uom_type}
                    onValueChange={(v) => v && setForm({ ...form, uom_type: v as UomType })}
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
                </div>
              </div>

              <div>
                <Label>Goal Title <span className="text-destructive">*</span></Label>
                <Input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. Improve CSAT"
                  required
                />
                {fieldErrors.title && (
                  <p className="text-xs text-destructive mt-1">{fieldErrors.title}</p>
                )}
              </div>

              <div>
                <Label>Goal Description</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Describe the KPI objective"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {needsTarget && (
                  <div>
                    <Label>Target Value <span className="text-destructive">*</span></Label>
                    <Input
                      type="number"
                      step="any"
                      value={form.target_value}
                      onChange={(e) => setForm({ ...form, target_value: e.target.value })}
                      placeholder="e.g. 90"
                      required
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
                    />
                    {fieldErrors.target_date && (
                      <p className="text-xs text-destructive mt-1">{fieldErrors.target_date}</p>
                    )}
                  </div>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <Label className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Select Employees <span className="text-destructive">*</span>
                    <Badge variant="outline" className="ml-1">{selectedMembers.length} selected</Badge>
                  </Label>
                  {teamMembers.length > 0 && (
                    <Button type="button" variant="ghost" size="sm" onClick={toggleAll}>
                      {selectedMembers.length === teamMembers.length ? "Deselect All" : "Select All"}
                    </Button>
                  )}
                </div>
                {teamMembers.length > 0 ? (
                  <div className="border rounded-lg max-h-64 overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-10"></TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Department</TableHead>
                          <TableHead>Designation</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {teamMembers.map((member) => (
                          <TableRow
                            key={member.id}
                            className="cursor-pointer"
                            onClick={() => toggleMember(member.id)}
                          >
                            <TableCell onClick={(e) => e.stopPropagation()}>
                              <Checkbox
                                checked={selectedMembers.includes(member.id)}
                                onCheckedChange={() => toggleMember(member.id)}
                              />
                            </TableCell>
                            <TableCell className="font-medium">{member.name}</TableCell>
                            <TableCell>{member.department}</TableCell>
                            <TableCell>{member.designation}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No team members found. Ask admin to assign reports to you.
                  </p>
                )}
              </div>

              <Button
                type="submit"
                disabled={submitting || selectedMembers.length === 0}
                className="w-full"
              >
                <Send className="h-4 w-4 mr-2" />
                {submitting ? "Creating..." : `Create & Assign KPI to ${selectedMembers.length} Member(s)`}
              </Button>

              {result && (
                <Card className="border-green-200 bg-green-50">
                  <CardContent className="py-3 space-y-1">
                    <p className="text-sm font-medium text-green-800 flex items-center gap-2">
                      <CheckCircle className="h-4 w-4" />
                      {result.count} shared goal(s) created successfully
                    </p>
                    {result.skipped.length > 0 && (
                      <p className="text-xs text-green-700">
                        Skipped (already had goal): {result.skipped.join(", ")}
                      </p>
                    )}
                    {result.lockedSkipped.length > 0 && (
                      <p className="text-xs text-orange-700">
                        Skipped (sheet locked/full): {result.lockedSkipped.join(", ")}
                      </p>
                    )}
                  </CardContent>
                </Card>
              )}
            </form>
          </CardContent>
        </Card>

        {sharedKpis.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Eye className="h-5 w-5" /> Shared KPIs History
              </CardTitle>
              <CardDescription>
                KPIs you have created and assigned to your team.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {sharedKpis.map((kpi) => {
                const isExpanded = expandedKpis.has(kpi.id);
                return (
                  <div key={kpi.id} className="border rounded-lg">
                    <button
                      type="button"
                      className="flex items-center justify-between w-full p-4 text-left hover:bg-muted/50 transition-colors"
                      onClick={() => {
                        setExpandedKpis((prev) => {
                          const next = new Set(prev);
                          if (next.has(kpi.id)) next.delete(kpi.id);
                          else next.add(kpi.id);
                          return next;
                        });
                      }}
                    >
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="font-medium">{kpi.title}</span>
                        <Badge variant="outline" className="text-xs">
                          {kpi.thrust_area?.name || "—"}
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          {getUomLabel(kpi.uom_type)}: {kpi.target_value ?? kpi.target_date ?? "—"}
                        </Badge>
                        <Badge className="text-xs">
                          {kpi.linked_goals.length} employee(s)
                        </Badge>
                      </div>
                      <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                    </button>
                    {isExpanded && (
                      <div className="border-t">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Employee</TableHead>
                              <TableHead>Department</TableHead>
                              <TableHead>Weightage</TableHead>
                              <TableHead>Status</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {kpi.linked_goals.map((lg) => (
                              <TableRow key={lg.id}>
                                <TableCell className="font-medium">{lg.employee_name}</TableCell>
                                <TableCell>{lg.department}</TableCell>
                                <TableCell><Badge variant="secondary">{lg.weightage}%</Badge></TableCell>
                                <TableCell><Badge variant="outline" className="capitalize">{lg.status}</Badge></TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
