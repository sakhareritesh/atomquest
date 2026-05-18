import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  const { error: authError } = await requireRole(request, ["admin"]);
  if (authError) return authError;

  const supabase = createAdminClient();
  const { searchParams } = new URL(request.url);
  const requestedCycleId = searchParams.get("cycle_id");

  let cycleId: string | null = null;

  if (requestedCycleId) {
    const { data } = await supabase
      .from("cycles")
      .select("id")
      .eq("id", requestedCycleId)
      .single();
    if (data) cycleId = data.id;
  }

  if (!cycleId) {
    const { data } = await supabase
      .from("cycles")
      .select("id")
      .eq("status", "active")
      .order("year", { ascending: false })
      .limit(1)
      .single();
    cycleId = data?.id || null;
  }

  if (!cycleId) {
    return NextResponse.json({
      thrustAreaDistribution: [],
      uomDistribution: [],
      statusDistribution: [],
      qoqTrends: [],
      managerEffectiveness: [],
      departmentRates: [],
    });
  }

  let goalsQuery = supabase
    .from("goals")
    .select("id, thrust_area_id, uom_type, status, weightage, thrust_area:thrust_areas(name)")
    .eq("cycle_id", cycleId);

  const { data: goals } = await goalsQuery;

  const thrustAreaDist: Record<string, number> = {};
  const uomDist: Record<string, number> = {};
  const statusDist: Record<string, number> = {};

  (goals || []).forEach((g) => {
    const ta = g.thrust_area as unknown as { name: string } | null;
    const taName = ta?.name || "Unknown";
    thrustAreaDist[taName] = (thrustAreaDist[taName] || 0) + 1;
    uomDist[g.uom_type] = (uomDist[g.uom_type] || 0) + 1;
    statusDist[g.status] = (statusDist[g.status] || 0) + 1;
  });

  const goalIds = (goals || []).map((g) => g.id);

  let achievements: { quarter: string; computed_score: number | null; progress_status: string }[] = [];
  if (goalIds.length > 0) {
    const { data } = await supabase
      .from("achievements")
      .select("quarter, computed_score, progress_status")
      .in("goal_id", goalIds);
    achievements = data || [];
  }

  const quarterScores: Record<string, { total: number; count: number; completed: number }> = {};
  achievements.forEach((a) => {
    if (!quarterScores[a.quarter]) {
      quarterScores[a.quarter] = { total: 0, count: 0, completed: 0 };
    }
    if (a.computed_score != null) {
      quarterScores[a.quarter].total += a.computed_score;
      quarterScores[a.quarter].count += 1;
    }
    if (a.progress_status === "completed") {
      quarterScores[a.quarter].completed += 1;
    }
  });

  const qoqTrends = ["Q1", "Q2", "Q3", "Q4"].map((q) => ({
    quarter: q,
    avgScore: quarterScores[q] && quarterScores[q].count > 0
      ? Math.round(quarterScores[q].total / quarterScores[q].count)
      : 0,
    completed: quarterScores[q]?.completed || 0,
    total: quarterScores[q]?.count || 0,
  }));

  const { data: managers } = await supabase
    .from("users")
    .select("id, name")
    .eq("role", "manager");

  const managerStats = [];
  for (const mgr of managers || []) {
    const { data: teamMembers } = await supabase
      .from("users")
      .select("id")
      .eq("manager_id", mgr.id);

    const teamIds = (teamMembers || []).map((t) => t.id);
    if (teamIds.length === 0) continue;

    const { count: sheetCount } = await supabase
      .from("goal_sheets")
      .select("*", { count: "exact" })
      .eq("cycle_id", cycleId)
      .in("employee_id", teamIds)
      .in("status", ["approved", "locked"]);

    const { count: checkinCount } = await supabase
      .from("checkins")
      .select("*", { count: "exact" })
      .eq("manager_id", mgr.id);

    managerStats.push({
      name: mgr.name,
      teamSize: teamIds.length,
      approvedSheets: sheetCount || 0,
      checkinsCompleted: checkinCount || 0,
    });
  }

  const { data: users } = await supabase.from("users").select("id, department");
  const deptMap: Record<string, string[]> = {};
  (users || []).forEach((u) => {
    if (!deptMap[u.department]) deptMap[u.department] = [];
    deptMap[u.department].push(u.id);
  });

  const departmentRates = [];
  for (const [dept, userIds] of Object.entries(deptMap)) {
    if (userIds.length === 0) continue;

    const { count: total } = await supabase
      .from("goal_sheets")
      .select("*", { count: "exact" })
      .eq("cycle_id", cycleId)
      .in("employee_id", userIds);

    const { count: approved } = await supabase
      .from("goal_sheets")
      .select("*", { count: "exact" })
      .eq("cycle_id", cycleId)
      .in("employee_id", userIds)
      .in("status", ["approved", "locked"]);

    departmentRates.push({
      department: dept,
      total: total || 0,
      approved: approved || 0,
      rate: total ? Math.round(((approved || 0) / total) * 100) : 0,
    });
  }

  return NextResponse.json({
    thrustAreaDistribution: Object.entries(thrustAreaDist).map(([name, value]) => ({ name, value })),
    uomDistribution: Object.entries(uomDist).map(([name, value]) => ({ name, value })),
    statusDistribution: Object.entries(statusDist).map(([name, value]) => ({ name, value })),
    qoqTrends,
    managerEffectiveness: managerStats,
    departmentRates,
  });
}
