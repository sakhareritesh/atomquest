import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeQuarterlyOverallScores } from "@/lib/utils/score-calculator";

export async function GET(request: NextRequest) {
  const { user, error: authError } = await requireRole(request, ["employee", "manager", "admin"]);
  if (authError) return authError;

  const supabase = createAdminClient();
  const { searchParams } = new URL(request.url);
  const requestedCycleId = searchParams.get("cycle_id");

  let cycle: { id: string; [key: string]: unknown } | null = null;

  if (requestedCycleId && user.role === "admin") {
    const { data } = await supabase
      .from("cycles")
      .select("*")
      .eq("id", requestedCycleId)
      .single();
    cycle = data;
  }

  if (!cycle) {
    const { data } = await supabase
      .from("cycles")
      .select("*")
      .eq("status", "active")
      .order("year", { ascending: false })
      .limit(1)
      .single();
    cycle = data;
  }

  if (!cycle) {
    return NextResponse.json({ stats: {}, activeCycle: null });
  }

  if (user.role === "employee") {
    return handleEmployeeDashboard(supabase, user.id as string, cycle);
  }

  if (user.role === "manager") {
    return handleManagerDashboard(supabase, user.id as string, cycle);
  }

  return handleAdminDashboard(supabase, cycle);
}

async function handleEmployeeDashboard(
  supabase: ReturnType<typeof createAdminClient>,
  userId: string,
  activeCycle: { id: string; [key: string]: unknown }
) {
  const { data: mySheet } = await supabase
    .from("goal_sheets")
    .select("*, goals(*, thrust_area:thrust_areas(*))")
    .eq("employee_id", userId)
    .eq("cycle_id", activeCycle.id)
    .single();

  const goalIds = (mySheet?.goals || []).map((g: { id: string }) => g.id);

  let myAchievements: Record<string, unknown>[] = [];
  if (goalIds.length > 0) {
    const { data } = await supabase
      .from("achievements")
      .select("*")
      .in("goal_id", goalIds);
    myAchievements = data || [];
  }

  const { data: quarterlyWindows } = await supabase
    .from("quarterly_windows")
    .select("*")
    .eq("cycle_id", activeCycle.id)
    .order("quarter");

  const goals = (mySheet?.goals || []) as Array<{ id: string; weightage: number }>;
  const overallScores = computeQuarterlyOverallScores(
    goals,
    myAchievements as Array<{ goal_id: string; quarter: string; computed_score: number | null }>
  );

  // Fetch pending escalations targeting this employee
  const { data: myEscalations } = await supabase
    .from("escalations")
    .select("*, target_user:users!escalations_target_user_id_fkey(id, name, email, role)")
    .eq("target_user_id", userId)
    .in("status", ["pending", "escalated"])
    .order("triggered_at", { ascending: false });

  return NextResponse.json({
    activeCycle,
    goalSheet: mySheet,
    achievements: myAchievements,
    quarterlyWindows: quarterlyWindows || [],
    overallScores,
    pendingEscalations: myEscalations || [],
    stats: {
      totalGoals: mySheet?.goals?.length || 0,
      sheetStatus: mySheet?.status || "not_created",
      totalWeightage: (mySheet?.goals || []).reduce(
        (sum: number, g: { weightage: number }) => sum + g.weightage,
        0
      ),
    },
  });
}

async function handleManagerDashboard(
  supabase: ReturnType<typeof createAdminClient>,
  userId: string,
  activeCycle: { id: string; [key: string]: unknown }
) {
  const { data: teamMembers } = await supabase
    .from("users")
    .select("id, name, department")
    .eq("manager_id", userId);

  const teamIds = teamMembers?.map((m) => m.id) || [];

  const { data: teamSheets } = await supabase
    .from("goal_sheets")
    .select("*")
    .eq("cycle_id", activeCycle.id)
    .in("employee_id", teamIds.length > 0 ? teamIds : ["00000000-0000-0000-0000-000000000000"]);

  const empMap = new Map((teamMembers || []).map((m) => [m.id, m]));
  for (const sheet of teamSheets || []) {
    (sheet as Record<string, unknown>).employee = empMap.get(sheet.employee_id) || null;
  }

  const pendingApprovals = (teamSheets || []).filter((s) => s.status === "submitted").length;
  const approvedSheets = (teamSheets || []).filter(
    (s) => s.status === "approved" || s.status === "locked"
  ).length;

  const approvedSheetIds = (teamSheets || [])
    .filter((s) => s.status === "approved" || s.status === "locked")
    .map((s) => s.id);

  let teamGoals: Array<{ id: string; weightage: number; employee_id: string }> = [];
  let teamAchievements: Array<{ goal_id: string; quarter: string; computed_score: number | null }> = [];

  if (approvedSheetIds.length > 0) {
    const { data: goals } = await supabase
      .from("goals")
      .select("id, weightage, employee_id")
      .in("goal_sheet_id", approvedSheetIds)
      .in("status", ["locked", "approved"]);
    teamGoals = (goals || []) as typeof teamGoals;

    const goalIds = teamGoals.map((g) => g.id);
    if (goalIds.length > 0) {
      const { data: achs } = await supabase
        .from("achievements")
        .select("goal_id, quarter, computed_score")
        .in("goal_id", goalIds);
      teamAchievements = (achs || []) as typeof teamAchievements;
    }
  }

  const teamOverallScores: Record<string, Record<string, number>> = {};
  for (const memberId of teamIds) {
    const memberGoals = teamGoals.filter((g) => g.employee_id === memberId);
    const memberGoalIds = new Set(memberGoals.map((g) => g.id));
    const memberAchs = teamAchievements.filter((a) => memberGoalIds.has(a.goal_id));
    teamOverallScores[memberId] = computeQuarterlyOverallScores(memberGoals, memberAchs);
  }

  const { data: quarterlyWindows } = await supabase
    .from("quarterly_windows")
    .select("*")
    .eq("cycle_id", activeCycle.id)
    .order("quarter");

  const { data: managerSheet } = await supabase
    .from("goal_sheets")
    .select("*, goals(*, thrust_area:thrust_areas(*))")
    .eq("employee_id", userId)
    .eq("cycle_id", activeCycle.id)
    .single();

  let managerAchievements: Record<string, unknown>[] = [];
  const managerGoalIds = (managerSheet?.goals || []).map((g: { id: string }) => g.id);
  if (managerGoalIds.length > 0) {
    const { data } = await supabase
      .from("achievements")
      .select("*")
      .in("goal_id", managerGoalIds);
    managerAchievements = data || [];
  }

  const managerGoals = (managerSheet?.goals || []) as Array<{ id: string; weightage: number }>;
  const managerOverallScores = computeQuarterlyOverallScores(
    managerGoals,
    managerAchievements as Array<{ goal_id: string; quarter: string; computed_score: number | null }>
  );

  // Fetch escalations targeting this manager
  const { data: myEscalations } = await supabase
    .from("escalations")
    .select("*, target_user:users!escalations_target_user_id_fkey(id, name, email, role)")
    .eq("target_user_id", userId)
    .in("status", ["pending", "escalated"])
    .order("triggered_at", { ascending: false });

  // Fetch escalations targeting team members (so manager is aware)
  const allEscalationTargets = teamIds.length > 0 ? teamIds : ["00000000-0000-0000-0000-000000000000"];
  const { data: teamEscalations } = await supabase
    .from("escalations")
    .select("*, target_user:users!escalations_target_user_id_fkey(id, name, email, role)")
    .in("target_user_id", allEscalationTargets)
    .in("status", ["pending", "escalated"])
    .order("triggered_at", { ascending: false });

  return NextResponse.json({
    activeCycle,
    stats: {
      teamSize: teamMembers?.length || 0,
      pendingApprovals,
      approvedSheets: approvedSheets,
      totalSheets: teamSheets?.length || 0,
    },
    teamMembers,
    teamSheets,
    teamOverallScores,
    quarterlyWindows: quarterlyWindows || [],
    goalSheet: managerSheet,
    achievements: managerAchievements,
    overallScores: managerOverallScores,
    pendingEscalations: myEscalations || [],
    teamEscalations: teamEscalations || [],
  });
}

async function handleAdminDashboard(
  supabase: ReturnType<typeof createAdminClient>,
  activeCycle: { id: string; [key: string]: unknown }
) {
  const { data: allUsers, count: totalUsers } = await supabase
    .from("users")
    .select("*", { count: "exact" });

  const { data: allSheets } = await supabase
    .from("goal_sheets")
    .select("status")
    .eq("cycle_id", activeCycle.id);

  const submitted = (allSheets || []).filter((s) => s.status === "submitted").length;
  const approved = (allSheets || []).filter(
    (s) => s.status === "approved" || s.status === "locked"
  ).length;

  const { count: totalCheckins } = await supabase
    .from("checkins")
    .select("*", { count: "exact" });

  const { count: pendingEscalationCount } = await supabase
    .from("escalations")
    .select("*", { count: "exact", head: true })
    .in("status", ["pending", "escalated"]);

  const { count: violationCount } = await supabase
    .from("escalation_violations")
    .select("*", { count: "exact", head: true })
    .eq("is_escalated", false);

  return NextResponse.json({
    activeCycle,
    stats: {
      totalUsers: totalUsers || 0,
      totalSheets: allSheets?.length || 0,
      pendingApprovals: submitted,
      approvedSheets: approved,
      totalCheckins: totalCheckins || 0,
      employees: (allUsers || []).filter((u) => u.role === "employee").length,
      managers: (allUsers || []).filter((u) => u.role === "manager").length,
      pendingEscalations: pendingEscalationCount || 0,
      detectedViolations: violationCount || 0,
    },
  });
}
