"use client";

import { useEffect, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { Header } from "@/components/header";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BarChart3 } from "lucide-react";
import { toast } from "sonner";
import type { Cycle } from "@/types";

const AnalyticsCharts = dynamic(
  () => import("./charts").then((m) => ({ default: m.AnalyticsCharts })),
  {
    ssr: false,
    loading: () => (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i}>
            <CardHeader><Skeleton className="h-5 w-48" /></CardHeader>
            <CardContent>
              <Skeleton className="h-[280px] w-full rounded-lg" />
            </CardContent>
          </Card>
        ))}
      </div>
    ),
  }
);

interface AnalyticsData {
  thrustAreaDistribution: { name: string; value: number }[];
  uomDistribution: { name: string; value: number }[];
  statusDistribution: { name: string; value: number }[];
  qoqTrends: { quarter: string; avgScore: number; completed: number; total: number }[];
  managerEffectiveness: {
    name: string;
    teamSize: number;
    approvedSheets: number;
    checkinsCompleted: number;
  }[];
  departmentRates: {
    department: string;
    total: number;
    approved: number;
    rate: number;
  }[];
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [selectedCycle, setSelectedCycle] = useState("");

  useEffect(() => {
    fetch("/api/cycles")
      .then((r) => {
        if (!r.ok) throw new Error("Failed");
        return r.json();
      })
      .then((d) => {
        setCycles(d.cycles || []);
        const active = d.cycles?.find((c: Cycle) => c.status === "active");
        if (active) setSelectedCycle(active.id);
      })
      .catch(() => toast.error("Failed to load cycles"));
  }, []);

  const fetchAnalytics = useCallback(async () => {
    if (!selectedCycle) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/analytics?cycle_id=${selectedCycle}`);
      if (!res.ok) {
        toast.error("Failed to load analytics");
        setData(null);
        return;
      }
      const d = await res.json();
      setData(d);
    } catch {
      toast.error("Failed to load analytics");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [selectedCycle]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  return (
    <div>
      <Header title="Analytics" />
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            <p className="text-sm text-muted-foreground">
              Organization-wide goal analytics and trends
            </p>
          </div>
          <Select value={selectedCycle} onValueChange={(v) => v && setSelectedCycle(v)} items={cycles.map((c) => ({ value: c.id, label: c.name }))}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Select cycle" />
            </SelectTrigger>
            <SelectContent>
              {cycles.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i}>
                <CardHeader><Skeleton className="h-5 w-48" /></CardHeader>
                <CardContent>
                  <Skeleton className="h-[280px] w-full rounded-lg" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : !data ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <div className="h-16 w-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
              <BarChart3 className="h-8 w-8 opacity-40" />
            </div>
            <p className="text-sm font-medium">Failed to load analytics data</p>
            <p className="text-xs mt-1">Try selecting a different cycle or refresh the page</p>
          </div>
        ) : (
          <AnalyticsCharts data={data} />
        )}
      </div>
    </div>
  );
}
