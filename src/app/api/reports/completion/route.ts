import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  try {
  const { error: authError } = await requireRole(request, ["admin"]);
  if (authError) return authError;

  const supabase = createAdminClient();
  const { searchParams } = new URL(request.url);
  const cycleId = searchParams.get("cycle_id");

  let activeCycleId = cycleId;

  if (!activeCycleId) {
    const { data: cycle } = await supabase
      .from("cycles")
      .select("id")
      .eq("status", "active")
      .order("year", { ascending: false })
      .limit(1)
      .single();
    activeCycleId = cycle?.id || null;
  }

  if (!activeCycleId) {
    return NextResponse.json({
      completionGrid: [],
      stats: {
        totalSheets: 0,
        approvedSheets: 0,
        pendingApproval: 0,
        totalExpectedCheckins: 0,
        completedCheckins: 0,
      },
    });
  }

  // Get all quarterly windows for this cycle to know which quarters have closed
  const { data: windows } = await supabase
    .from("quarterly_windows")
    .select("quarter, window_open, window_close, status")
    .eq("cycle_id", activeCycleId)
    .order("quarter");

  const now = new Date();
  const closedOrOpenQuarters = (windows || []).filter((w) => {
    const openDate = new Date(w.window_open);
    return openDate <= now;
  });
  const relevantQuarters = closedOrOpenQuarters.map((w) => w.quarter);

  // Get all goal sheets for this cycle
  const { data: sheets } = await supabase
    .from("goal_sheets")
    .select("id, employee_id, status")
    .eq("cycle_id", activeCycleId);

  if (!sheets || sheets.length === 0) {
    return NextResponse.json({
      completionGrid: [],
      stats: {
        totalSheets: 0,
        approvedSheets: 0,
        pendingApproval: 0,
        totalExpectedCheckins: 0,
        completedCheckins: 0,
      },
    });
  }

  // Get all employees and their managers
  const empIds = [...new Set(sheets.map((s) => s.employee_id))];
  const { data: employees } = await supabase
    .from("users")
    .select("id, name, department, manager_id")
    .in("id", empIds);
  const empMap = new Map((employees || []).map((e) => [e.id, e]));

  // Get manager names
  const mgrIds = [...new Set((employees || []).map((e) => e.manager_id).filter(Boolean))] as string[];
  let mgrMap = new Map<string, { name: string }>();
  if (mgrIds.length > 0) {
    const { data: managers } = await supabase
      .from("users")
      .select("id, name")
      .in("id", mgrIds);
    mgrMap = new Map((managers || []).map((m) => [m.id, m]));
  }

  // Get all checkins for sheets in this cycle
  const sheetIds = sheets.map((s) => s.id);
  const { data: checkins } = await supabase
    .from("checkins")
    .select("goal_sheet_id, quarter, manager_id, created_at")
    .in("goal_sheet_id", sheetIds);

  const checkinMap = new Map<string, { manager_id: string; created_at: string }>();
  (checkins || []).forEach((c) => {
    checkinMap.set(`${c.goal_sheet_id}::${c.quarter}`, {
      manager_id: c.manager_id,
      created_at: c.created_at,
    });
  });

  // Build the completion grid
  const approvedStatuses = ["approved", "locked"];
  const completionGrid = sheets.map((sheet) => {
    const emp = empMap.get(sheet.employee_id);
    const mgrName = emp?.manager_id ? mgrMap.get(emp.manager_id)?.name : null;

    const quarters: Record<string, { done: boolean; managerName?: string; date?: string } | undefined> = {};

    for (const q of ["Q1", "Q2", "Q3", "Q4"]) {
      if (!relevantQuarters.includes(q)) {
        quarters[q] = undefined;
        continue;
      }

      const checkin = checkinMap.get(`${sheet.id}::${q}`);
      if (checkin) {
        const checkinMgr = mgrMap.get(checkin.manager_id);
        quarters[q] = {
          done: true,
          managerName: checkinMgr?.name,
          date: checkin.created_at,
        };
      } else {
        quarters[q] = { done: false };
      }
    }

    return {
      employeeId: sheet.employee_id,
      employeeName: emp?.name || "Unknown",
      department: emp?.department || "",
      managerName: mgrName || "",
      sheetId: sheet.id,
      sheetStatus: sheet.status,
      quarters,
    };
  });

  // Sort by department, then name
  completionGrid.sort((a, b) => {
    const deptCmp = a.department.localeCompare(b.department);
    if (deptCmp !== 0) return deptCmp;
    return a.employeeName.localeCompare(b.employeeName);
  });

  // Compute stats
  const totalSheets = sheets.length;
  const approvedSheets = sheets.filter((s) => approvedStatuses.includes(s.status)).length;
  const pendingApproval = sheets.filter((s) => s.status === "submitted").length;

  // For approved/locked sheets only, count expected vs done checkins
  const approvedSheetIds = sheets
    .filter((s) => approvedStatuses.includes(s.status))
    .map((s) => s.id);
  const totalExpectedCheckins = approvedSheetIds.length * relevantQuarters.length;
  let completedCheckins = 0;
  for (const sid of approvedSheetIds) {
    for (const q of relevantQuarters) {
      if (checkinMap.has(`${sid}::${q}`)) completedCheckins++;
    }
  }

  return NextResponse.json({
    completionGrid,
    stats: {
      totalSheets,
      approvedSheets,
      pendingApproval,
      totalExpectedCheckins,
      completedCheckins,
    },
  });
  } catch (err) {
    console.error("[reports/completion]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
