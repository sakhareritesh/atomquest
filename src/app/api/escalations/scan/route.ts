import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";

const APPROVAL_PENDING_DAYS = 7;

export async function POST(request: NextRequest) {
  const { error: authError } = await requireRole(request, ["admin"]);
  if (authError) return authError;

  const supabase = createAdminClient();

  const { data: activeCycle } = await supabase
    .from("cycles")
    .select("*")
    .eq("status", "active")
    .order("year", { ascending: false })
    .limit(1)
    .single();

  if (!activeCycle) {
    return NextResponse.json({ error: "No active cycle found" }, { status: 404 });
  }

  const { data: windows } = await supabase
    .from("quarterly_windows")
    .select("*")
    .eq("cycle_id", activeCycle.id);

  const { data: allEmployees } = await supabase
    .from("users")
    .select("id, name, role, department, manager_id")
    .in("role", ["employee", "manager"]);

  const { data: allSheets } = await supabase
    .from("goal_sheets")
    .select("id, employee_id, status, submitted_at")
    .eq("cycle_id", activeCycle.id);

  const sheetMap = new Map(
    (allSheets || []).map((s) => [s.employee_id, s])
  );

  const now = new Date();
  const violations: Array<{
    rule_type: string;
    target_user_id: string;
    cycle_id: string;
    details: Record<string, unknown>;
  }> = [];

  // 1. goal_not_submitted: employees with no sheet or draft past goal_setting_end
  const goalSettingEnd = new Date(activeCycle.goal_setting_end);
  if (now > goalSettingEnd) {
    for (const emp of allEmployees || []) {
      const sheet = sheetMap.get(emp.id);
      if (!sheet || sheet.status === "draft") {
        violations.push({
          rule_type: "goal_not_submitted",
          target_user_id: emp.id,
          cycle_id: activeCycle.id,
          details: {
            sheet_status: sheet?.status || "not_created",
            goal_setting_end: activeCycle.goal_setting_end,
          },
        });
      }
    }
  }

  // 2. approval_pending: sheets submitted for > N days
  const pendingThreshold = new Date(now.getTime() - APPROVAL_PENDING_DAYS * 86400000);
  for (const sheet of allSheets || []) {
    if (
      sheet.status === "submitted" &&
      sheet.submitted_at &&
      new Date(sheet.submitted_at) < pendingThreshold
    ) {
      const emp = (allEmployees || []).find((e) => e.id === sheet.employee_id);
      const managerId = emp?.manager_id;
      if (managerId) {
        violations.push({
          rule_type: "approval_pending",
          target_user_id: managerId,
          cycle_id: activeCycle.id,
          details: {
            employee_id: sheet.employee_id,
            employee_name: emp?.name,
            sheet_id: sheet.id,
            submitted_at: sheet.submitted_at,
            days_pending: Math.floor(
              (now.getTime() - new Date(sheet.submitted_at).getTime()) / 86400000
            ),
          },
        });
      }
    }
  }

  // 3. checkin_missing: closed quarters with no checkin for approved/locked sheets
  const closedWindows = (windows || []).filter(
    (w) => w.status === "closed" && new Date(w.window_close) < now
  );

  if (closedWindows.length > 0) {
    const approvedSheetIds = (allSheets || [])
      .filter((s) => s.status === "approved" || s.status === "locked")
      .map((s) => s.id);

    if (approvedSheetIds.length > 0) {
      const { data: existingCheckins } = await supabase
        .from("checkins")
        .select("goal_sheet_id, quarter")
        .in("goal_sheet_id", approvedSheetIds);

      const checkinSet = new Set(
        (existingCheckins || []).map((c) => `${c.goal_sheet_id}::${c.quarter}`)
      );

      for (const sheet of allSheets || []) {
        if (sheet.status !== "approved" && sheet.status !== "locked") continue;
        const emp = (allEmployees || []).find((e) => e.id === sheet.employee_id);
        const managerId = emp?.manager_id;
        if (!managerId) continue;

        for (const win of closedWindows) {
          if (!checkinSet.has(`${sheet.id}::${win.quarter}`)) {
            violations.push({
              rule_type: "checkin_missing",
              target_user_id: managerId,
              cycle_id: activeCycle.id,
              details: {
                employee_id: sheet.employee_id,
                employee_name: emp?.name,
                sheet_id: sheet.id,
                quarter: win.quarter,
              },
            });
          }
        }
      }
    }
  }

  // 4. achievement_not_updated: open or recently-closed windows with no achievement rows
  const relevantWindows = (windows || []).filter((w) => {
    const closeDate = new Date(w.window_close);
    const openDate = new Date(w.window_open);
    return (
      (w.status === "open" && now >= openDate) ||
      (w.status === "closed" && now <= new Date(closeDate.getTime() + 7 * 86400000))
    );
  });

  if (relevantWindows.length > 0) {
    const approvedSheets = (allSheets || []).filter(
      (s) => s.status === "approved" || s.status === "locked"
    );

    if (approvedSheets.length > 0) {
      const approvedSheetIds = approvedSheets.map((s) => s.id);
      const { data: goalsInSheets } = await supabase
        .from("goals")
        .select("id, employee_id, goal_sheet_id")
        .in("goal_sheet_id", approvedSheetIds);

      if (goalsInSheets && goalsInSheets.length > 0) {
        const goalIds = goalsInSheets.map((g) => g.id);
        const { data: existingAchievements } = await supabase
          .from("achievements")
          .select("goal_id, quarter")
          .in("goal_id", goalIds);

        const achSet = new Set(
          (existingAchievements || []).map((a) => `${a.goal_id}::${a.quarter}`)
        );

        const employeesMissing = new Map<string, string[]>();

        for (const goal of goalsInSheets) {
          for (const win of relevantWindows) {
            if (!achSet.has(`${goal.id}::${win.quarter}`)) {
              const existing = employeesMissing.get(goal.employee_id) || [];
              if (!existing.includes(win.quarter)) {
                existing.push(win.quarter);
                employeesMissing.set(goal.employee_id, existing);
              }
            }
          }
        }

        for (const [empId, quarters] of employeesMissing) {
          violations.push({
            rule_type: "achievement_not_updated",
            target_user_id: empId,
            cycle_id: activeCycle.id,
            details: { quarters_missing: quarters },
          });
        }
      }
    }
  }

  // Upsert violations (deduplicate by rule_type + target_user_id + cycle_id)
  let upserted = 0;
  for (const v of violations) {
    const { error } = await supabase
      .from("escalation_violations")
      .upsert(
        {
          rule_type: v.rule_type,
          target_user_id: v.target_user_id,
          cycle_id: v.cycle_id,
          details: v.details,
          detected_at: new Date().toISOString(),
          is_escalated: false,
        },
        { onConflict: "rule_type,target_user_id,cycle_id", ignoreDuplicates: false }
      );
    if (!error) upserted++;
  }

  return NextResponse.json({
    summary: {
      total_violations: violations.length,
      upserted,
      by_type: {
        goal_not_submitted: violations.filter((v) => v.rule_type === "goal_not_submitted").length,
        approval_pending: violations.filter((v) => v.rule_type === "approval_pending").length,
        checkin_missing: violations.filter((v) => v.rule_type === "checkin_missing").length,
        achievement_not_updated: violations.filter((v) => v.rule_type === "achievement_not_updated").length,
      },
    },
  });
}

export async function GET(request: NextRequest) {
  const { error: authError } = await requireRole(request, ["admin"]);
  if (authError) return authError;

  const supabase = createAdminClient();
  const { searchParams } = new URL(request.url);
  const showEscalated = searchParams.get("show_escalated") === "true";

  let query = supabase
    .from("escalation_violations")
    .select("*, target_user:users!escalation_violations_target_user_id_fkey(id, name, email, role, department)")
    .order("detected_at", { ascending: false });

  if (!showEscalated) {
    query = query.eq("is_escalated", false);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ violations: data || [] });
}
