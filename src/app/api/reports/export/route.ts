import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import * as XLSX from "xlsx";

export async function GET(request: NextRequest) {
  const { user, error: authError } = await requireRole(request, ["admin", "manager"]);
  if (authError) return authError;

  const supabase = createAdminClient();
  const { searchParams } = new URL(request.url);
  const cycleId = searchParams.get("cycle_id");
  const format = searchParams.get("format") || "xlsx";
  const reportType = searchParams.get("type") || "achievement";

  if (reportType === "audit") {
    return generateAuditExport(supabase, format, searchParams);
  }

  let goalsQuery = supabase
    .from("goals")
    .select("*, thrust_area:thrust_areas(name)")
    .in("status", ["locked", "approved"]);

  if (cycleId) goalsQuery = goalsQuery.eq("cycle_id", cycleId);

  if (user.role === "manager") {
    const { data: teamMembers } = await supabase
      .from("users")
      .select("id")
      .eq("manager_id", user.id);
    const teamIds = (teamMembers || []).map((m) => m.id);
    if (teamIds.length > 0) {
      goalsQuery = goalsQuery.in("employee_id", teamIds);
    } else {
      return NextResponse.json({ error: "No team members" }, { status: 404 });
    }
  }

  const { data: goals } = await goalsQuery;
  if (!goals || goals.length === 0) return NextResponse.json({ error: "No data" }, { status: 404 });

  const empIds = [...new Set(goals.map((g) => g.employee_id))];
  const { data: employees } = await supabase
    .from("users")
    .select("id, name, department, designation")
    .in("id", empIds);
  const empMap = new Map((employees || []).map((e) => [e.id, e]));

  const goalIds = goals.map((g) => g.id);
  const { data: achievements } = await supabase
    .from("achievements")
    .select("*")
    .in("goal_id", goalIds);

  const achievementMap = new Map<string, Record<string, unknown>>();
  (achievements || []).forEach((a) => {
    achievementMap.set(`${a.goal_id}_${a.quarter}`, a);
  });

  const rows = goals.map((g) => {
    const emp = empMap.get(g.employee_id) as { name: string; department: string; designation: string } | undefined;
    const q1 = achievementMap.get(`${g.id}_Q1`) as Record<string, unknown> | undefined;
    const q2 = achievementMap.get(`${g.id}_Q2`) as Record<string, unknown> | undefined;
    const q3 = achievementMap.get(`${g.id}_Q3`) as Record<string, unknown> | undefined;
    const q4 = achievementMap.get(`${g.id}_Q4`) as Record<string, unknown> | undefined;

    const isTimeline = g.uom_type === "timeline";
    const targetDisplay = isTimeline ? (g.target_date || "") : (g.target_value ?? "");

    return {
      "Employee": emp?.name || "",
      "Department": emp?.department || "",
      "Designation": emp?.designation || "",
      "Thrust Area": (g.thrust_area as { name: string })?.name || "",
      "Goal": g.title,
      "UoM Type": g.uom_type,
      "Target": targetDisplay,
      "Weightage %": g.weightage,
      "Q1 Planned": (q1?.planned_target as number) ?? "",
      "Q1 Actual": isTimeline ? (q1?.completion_date || "") : ((q1?.actual_achievement as number) ?? ""),
      "Q1 Score": (q1?.computed_score as number) ?? "",
      "Q1 Status": (q1?.progress_status as string) || "",
      "Q2 Planned": (q2?.planned_target as number) ?? "",
      "Q2 Actual": isTimeline ? (q2?.completion_date || "") : ((q2?.actual_achievement as number) ?? ""),
      "Q2 Score": (q2?.computed_score as number) ?? "",
      "Q2 Status": (q2?.progress_status as string) || "",
      "Q3 Planned": (q3?.planned_target as number) ?? "",
      "Q3 Actual": isTimeline ? (q3?.completion_date || "") : ((q3?.actual_achievement as number) ?? ""),
      "Q3 Score": (q3?.computed_score as number) ?? "",
      "Q3 Status": (q3?.progress_status as string) || "",
      "Q4 Planned": (q4?.planned_target as number) ?? "",
      "Q4 Actual": isTimeline ? (q4?.completion_date || "") : ((q4?.actual_achievement as number) ?? ""),
      "Q4 Score": (q4?.computed_score as number) ?? "",
      "Q4 Status": (q4?.progress_status as string) || "",
    };
  });

  const ws = XLSX.utils.json_to_sheet(rows);

  // Auto-size columns
  const colWidths = Object.keys(rows[0] || {}).map((key) => ({
    wch: Math.max(
      key.length,
      ...rows.map((r) => String((r as Record<string, unknown>)[key] ?? "").length)
    ) + 2,
  }));
  ws["!cols"] = colWidths;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Achievement Report");

  if (format === "csv") {
    const csv = XLSX.utils.sheet_to_csv(ws);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": "attachment; filename=achievement_report.csv",
      },
    });
  }

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": "attachment; filename=achievement_report.xlsx",
    },
  });
}

async function generateAuditExport(
  supabase: ReturnType<typeof createAdminClient>,
  format: string,
  searchParams: URLSearchParams
) {
  const entityType = searchParams.get("entity_type");
  const action = searchParams.get("action");

  let query = supabase
    .from("audit_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(5000);

  if (entityType) query = query.eq("entity_type", entityType);
  if (action) query = query.eq("action", action);

  const { data: logs, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!logs || logs.length === 0) return NextResponse.json({ error: "No audit logs found" }, { status: 404 });

  const userIds = [...new Set(logs.map((l) => l.user_id).filter(Boolean))];
  let userMap = new Map<string, { name: string }>();
  if (userIds.length > 0) {
    const { data: users } = await supabase
      .from("users")
      .select("id, name")
      .in("id", userIds);
    userMap = new Map((users || []).map((u) => [u.id, u]));
  }

  const rows = logs.map((log) => ({
    "Timestamp": new Date(log.created_at).toISOString(),
    "User": log.user_id ? (userMap.get(log.user_id)?.name || "Unknown") : "System",
    "Entity Type": log.entity_type,
    "Entity ID": log.entity_id,
    "Action": log.action,
    "Field Changed": log.field_changed || "",
    "Old Value": log.old_value || "",
    "New Value": log.new_value || "",
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  const colWidths = Object.keys(rows[0] || {}).map((key) => ({
    wch: Math.max(key.length, 15),
  }));
  ws["!cols"] = colWidths;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Audit Trail");

  if (format === "csv") {
    const csv = XLSX.utils.sheet_to_csv(ws);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": "attachment; filename=audit_trail.csv",
      },
    });
  }

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": "attachment; filename=audit_trail.xlsx",
    },
  });
}
