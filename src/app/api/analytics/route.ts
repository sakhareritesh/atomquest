import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  try {
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

    const { data: goals, error: goalsErr } = await supabase
      .from("goals")
      .select("id, thrust_area_id, uom_type, status, weightage, employee_id, thrust_area:thrust_areas(name)")
      .eq("cycle_id", cycleId);

    if (goalsErr) {
      console.error("[analytics] Goals query failed:", goalsErr.message);
      return NextResponse.json({ error: "Failed to fetch goals data" }, { status: 500 });
    }

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

    // Batch: fetch all managers, all team members, all sheets, and all checkins in parallel
    const [managersRes, usersRes, sheetsRes, checkinsRes] = await Promise.all([
      supabase.from("users").select("id, name").eq("role", "manager"),
      supabase.from("users").select("id, department, manager_id"),
      supabase.from("goal_sheets").select("id, employee_id, status").eq("cycle_id", cycleId),
      supabase.from("checkins").select("manager_id", { count: "exact" }),
    ]);

    const managers = managersRes.data || [];
    const allUsers = usersRes.data || [];
    const allSheets = sheetsRes.data || [];

    // Build maps for O(1) lookups
    const teamByManager = new Map<string, string[]>();
    const deptMap: Record<string, string[]> = {};
    for (const u of allUsers) {
      if (u.manager_id) {
        const team = teamByManager.get(u.manager_id) || [];
        team.push(u.id);
        teamByManager.set(u.manager_id, team);
      }
      if (!deptMap[u.department]) deptMap[u.department] = [];
      deptMap[u.department].push(u.id);
    }

    const sheetsByEmployee = new Map<string, typeof allSheets>();
    for (const s of allSheets) {
      const existing = sheetsByEmployee.get(s.employee_id) || [];
      existing.push(s);
      sheetsByEmployee.set(s.employee_id, existing);
    }

    // Count checkins per manager from existing data
    const checkinCountByManager = new Map<string, number>();
    if (checkinsRes.data) {
      for (const c of checkinsRes.data as Array<{ manager_id: string }>) {
        checkinCountByManager.set(c.manager_id, (checkinCountByManager.get(c.manager_id) || 0) + 1);
      }
    }

    // Manager effectiveness (no N+1)
    const managerStats = managers.map((mgr) => {
      const teamIds = teamByManager.get(mgr.id) || [];
      if (teamIds.length === 0) return null;

      const teamIdSet = new Set(teamIds);
      let approvedCount = 0;
      for (const s of allSheets) {
        if (teamIdSet.has(s.employee_id) && (s.status === "approved" || s.status === "locked")) {
          approvedCount++;
        }
      }

      return {
        name: mgr.name,
        teamSize: teamIds.length,
        approvedSheets: approvedCount,
        checkinsCompleted: checkinCountByManager.get(mgr.id) || 0,
      };
    }).filter(Boolean);

    // Department rates (no N+1)
    const departmentRates = Object.entries(deptMap).map(([dept, userIds]) => {
      if (userIds.length === 0) return null;
      const userIdSet = new Set(userIds);
      let total = 0;
      let approved = 0;
      for (const s of allSheets) {
        if (userIdSet.has(s.employee_id)) {
          total++;
          if (s.status === "approved" || s.status === "locked") approved++;
        }
      }
      return {
        department: dept,
        total,
        approved,
        rate: total ? Math.round((approved / total) * 100) : 0,
      };
    }).filter(Boolean);

    return NextResponse.json({
      thrustAreaDistribution: Object.entries(thrustAreaDist).map(([name, value]) => ({ name, value })),
      uomDistribution: Object.entries(uomDist).map(([name, value]) => ({ name, value })),
      statusDistribution: Object.entries(statusDist).map(([name, value]) => ({ name, value })),
      qoqTrends,
      managerEffectiveness: managerStats,
      departmentRates,
    });
  } catch (err) {
    console.error("[analytics] Unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
