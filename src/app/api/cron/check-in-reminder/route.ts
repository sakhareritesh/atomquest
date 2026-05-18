import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyCheckinReminder } from "@/lib/notifications";

export async function GET(request: NextRequest) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      console.error("[cron] CRON_SECRET not configured");
      return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
    }

    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createAdminClient();

    const { data: openWindows, error: winError } = await supabase
      .from("quarterly_windows")
      .select("cycle_id, quarter")
      .eq("status", "open");

    if (winError) {
      console.error("[cron] Failed to fetch windows:", winError.message);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    if (!openWindows || openWindows.length === 0) {
      return NextResponse.json({ message: "No open quarterly windows", reminders_sent: 0 });
    }

    let totalReminders = 0;
    let totalErrors = 0;

    for (const window of openWindows) {
      const { data: sheets } = await supabase
        .from("goal_sheets")
        .select("id, employee_id")
        .eq("cycle_id", window.cycle_id)
        .in("status", ["approved", "locked"]);

      if (!sheets || sheets.length === 0) continue;

      const sheetIds = sheets.map((s) => s.id);
      const { data: existingCheckins } = await supabase
        .from("checkins")
        .select("goal_sheet_id")
        .in("goal_sheet_id", sheetIds)
        .eq("quarter", window.quarter);

      const checkedSheetIds = new Set((existingCheckins || []).map((c) => c.goal_sheet_id));
      const pendingSheets = sheets.filter((s) => !checkedSheetIds.has(s.id));

      if (pendingSheets.length === 0) continue;

      const employeeIds = pendingSheets.map((s) => s.employee_id);
      const { data: employees } = await supabase
        .from("users")
        .select("id, name, manager_id")
        .in("id", employeeIds);

      if (!employees) continue;

      const managerGroups = new Map<string, string[]>();
      for (const emp of employees) {
        if (!emp.manager_id) continue;
        const list = managerGroups.get(emp.manager_id) || [];
        list.push(emp.name);
        managerGroups.set(emp.manager_id, list);
      }

      const managerIds = [...managerGroups.keys()];
      if (managerIds.length === 0) continue;

      const { data: managers } = await supabase
        .from("users")
        .select("id, name, email")
        .in("id", managerIds);

      for (const mgr of managers || []) {
        const teamMembers = managerGroups.get(mgr.id);
        if (!teamMembers || teamMembers.length === 0) continue;

        try {
          await notifyCheckinReminder({
            managerName: mgr.name,
            managerEmail: mgr.email,
            teamMembers,
            quarter: window.quarter,
          });
          totalReminders++;
        } catch (err) {
          totalErrors++;
          console.error(`[cron] Failed to notify manager ${mgr.id}:`, err);
        }
      }
    }

    return NextResponse.json({
      message: "Check-in reminders sent",
      reminders_sent: totalReminders,
      errors: totalErrors,
    });
  } catch (err) {
    console.error("[cron] Unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
