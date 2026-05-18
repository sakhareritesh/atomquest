import { NextRequest, NextResponse } from "next/server";
import { getUser, requireRole, parseJson } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  try {
  const user = await getUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createAdminClient();
  const { searchParams } = new URL(request.url);
  const goalSheetId = searchParams.get("goal_sheet_id");

  if (user.role === "employee") {
    if (!goalSheetId) return NextResponse.json({ checkins: [] });

    const { data: sheet } = await supabase
      .from("goal_sheets")
      .select("employee_id")
      .eq("id", goalSheetId)
      .single();
    if (!sheet || sheet.employee_id !== user.id) {
      return NextResponse.json({ error: "Not your goal sheet" }, { status: 403 });
    }
  }

  let query = supabase.from("checkins").select("*");

  if (goalSheetId) {
    query = query.eq("goal_sheet_id", goalSheetId);
  } else if (user.role === "manager") {
    const { data: teamMembers } = await supabase
      .from("users")
      .select("id")
      .eq("manager_id", user.id);
    const teamIds = (teamMembers || []).map((m) => m.id);
    if (teamIds.length === 0) return NextResponse.json({ checkins: [] });

    const { data: teamSheets } = await supabase
      .from("goal_sheets")
      .select("id")
      .in("employee_id", teamIds);
    const sheetIds = (teamSheets || []).map((s) => s.id);
    if (sheetIds.length === 0) return NextResponse.json({ checkins: [] });

    query = query.in("goal_sheet_id", sheetIds);
  }

  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (data && data.length > 0) {
    const managerIds = [...new Set(data.map((c) => c.manager_id))];
    const { data: managers } = await supabase
      .from("users")
      .select("*")
      .in("id", managerIds);
    const mgrMap = new Map((managers || []).map((m) => [m.id, m]));
    for (const checkin of data) {
      (checkin as Record<string, unknown>).manager = mgrMap.get(checkin.manager_id) || null;
    }

    const sheetIds = [...new Set(data.map((c) => c.goal_sheet_id))];
    const { data: sheets } = await supabase
      .from("goal_sheets")
      .select("id, employee_id")
      .in("id", sheetIds);
    const empIds = [...new Set((sheets || []).map((s) => s.employee_id))];
    if (empIds.length > 0) {
      const { data: emps } = await supabase.from("users").select("id, name").in("id", empIds);
      const empMap = new Map((emps || []).map((e) => [e.id, e]));
      const sheetEmpMap = new Map((sheets || []).map((s) => [s.id, empMap.get(s.employee_id)]));
      for (const checkin of data) {
        (checkin as Record<string, unknown>).employee = sheetEmpMap.get(checkin.goal_sheet_id) || null;
      }
    }
  }

  return NextResponse.json({ checkins: data });
  } catch (err) {
    console.error("[checkins:GET]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
  const { user, error: authError } = await requireRole(request, ["manager", "admin"]);
  if (authError) return authError;

  const body = await parseJson(request);
  if (!body?.goal_sheet_id || !body?.comment || !body?.quarter) {
    return NextResponse.json({ error: "goal_sheet_id, quarter, and comment are required" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: sheet } = await supabase
    .from("goal_sheets")
    .select("employee_id, cycle_id")
    .eq("id", body.goal_sheet_id)
    .single();

  if (!sheet) {
    return NextResponse.json({ error: "Goal sheet not found" }, { status: 404 });
  }

  if (user.role === "manager") {
    const { data: emp } = await supabase
      .from("users")
      .select("manager_id")
      .eq("id", sheet.employee_id)
      .single();
    if (!emp || emp.manager_id !== user.id) {
      return NextResponse.json({ error: "This employee is not your direct report" }, { status: 403 });
    }
  }

  if (user.role !== "admin") {
    const { data: window } = await supabase
      .from("quarterly_windows")
      .select("*")
      .eq("cycle_id", sheet.cycle_id)
      .eq("quarter", body.quarter)
      .single();

    if (!window) {
      return NextResponse.json(
        { error: `No quarterly window configured for ${body.quarter}` },
        { status: 403 }
      );
    }

    if (window.status !== "open") {
      return NextResponse.json(
        { error: `The quarterly window for ${body.quarter} is not currently open` },
        { status: 403 }
      );
    }
  }

  // Check if there's an existing checkin for audit purposes
  const { data: existingCheckin } = await supabase
    .from("checkins")
    .select("*")
    .eq("goal_sheet_id", body.goal_sheet_id)
    .eq("quarter", body.quarter)
    .single();

  const { data, error } = await supabase
    .from("checkins")
    .upsert(
      {
        goal_sheet_id: body.goal_sheet_id,
        quarter: body.quarter,
        manager_id: user.id,
        comment: body.comment,
      },
      { onConflict: "goal_sheet_id,quarter" }
    )
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (data) {
    const { data: mgr } = await supabase
      .from("users")
      .select("*")
      .eq("id", data.manager_id)
      .single();
    (data as Record<string, unknown>).manager = mgr;
  }

  // Audit log: track check-in create/update
  if (data) {
    const { data: emp } = await supabase
      .from("users")
      .select("name")
      .eq("id", sheet.employee_id)
      .single();

    if (existingCheckin) {
      await supabase.from("audit_logs").insert({
        entity_type: "checkin",
        entity_id: data.id,
        user_id: user.id,
        action: "update",
        field_changed: `${body.quarter} comment`,
        old_value: existingCheckin.comment,
        new_value: body.comment,
      });
    } else {
      await supabase.from("audit_logs").insert({
        entity_type: "checkin",
        entity_id: data.id,
        user_id: user.id,
        action: "create",
        field_changed: `${body.quarter} check-in`,
        old_value: "",
        new_value: `Check-in for ${emp?.name || "employee"}: ${body.comment.substring(0, 100)}`,
      });
    }
  }

  return NextResponse.json({ checkin: data });
  } catch (err) {
    console.error("[checkins:POST]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
