import { NextRequest, NextResponse } from "next/server";
import { getUser, parseJson } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyGoalSubmitted, notifyGoalApproved, notifyGoalRejected } from "@/lib/notifications";

export async function GET(request: NextRequest) {
  try {
  const user = await getUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createAdminClient();
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const managerId = searchParams.get("manager_id");
  const selfOnly = searchParams.get("self") === "true";

  let query = supabase
    .from("goal_sheets")
    .select("*, goals(*, thrust_area:thrust_areas(*))");

  if (status) query = query.eq("status", status);

  if (selfOnly) {
    query = query.eq("employee_id", user.id);
  } else if (user.role === "employee") {
    query = query.eq("employee_id", user.id);
  } else if (user.role === "manager") {
    const { data: teamMembers } = await supabase
      .from("users")
      .select("id")
      .eq("manager_id", user.id);

    const teamIds = teamMembers?.map((m) => m.id) || [];
    if (teamIds.length > 0) {
      query = query.in("employee_id", teamIds);
    } else {
      return NextResponse.json({ goalSheets: [] });
    }
  } else if (managerId) {
    const { data: teamMembers } = await supabase
      .from("users")
      .select("id")
      .eq("manager_id", managerId);

    const teamIds = teamMembers?.map((m) => m.id) || [];
    if (teamIds.length > 0) {
      query = query.in("employee_id", teamIds);
    } else {
      return NextResponse.json({ goalSheets: [] });
    }
  }

  const { data, error } = await query.order("created_at", { ascending: false });

  if (error) {
    console.error("Goal sheets GET error:", error.message, error.details, error.hint);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (data && data.length > 0) {
    const employeeIds = [...new Set(data.map((s) => s.employee_id))];
    const { data: employees } = await supabase
      .from("users")
      .select("*")
      .in("id", employeeIds);

    const empMap = new Map((employees || []).map((e) => [e.id, e]));
    for (const sheet of data) {
      (sheet as Record<string, unknown>).employee = empMap.get(sheet.employee_id) || null;
    }

    const cycleIds = [...new Set(data.map((s) => s.cycle_id))];
    const { data: cycles } = await supabase
      .from("cycles")
      .select("*")
      .in("id", cycleIds);

    const cycleMap = new Map((cycles || []).map((c) => [c.id, c]));
    for (const sheet of data) {
      (sheet as Record<string, unknown>).cycle = cycleMap.get(sheet.cycle_id) || null;
    }
  }

  return NextResponse.json({ goalSheets: data });
  } catch (err) {
    console.error("[goal-sheets:GET]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
  const user = await getUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await parseJson(request);
  if (!body?.id) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const supabase = createAdminClient();

  const { data: sheet } = await supabase
    .from("goal_sheets")
    .select("*")
    .eq("id", body.id)
    .single();

  if (!sheet) return NextResponse.json({ error: "Goal sheet not found" }, { status: 404 });

  if (body.status === "submitted" && sheet.employee_id !== user.id) {
    return NextResponse.json({ error: "Only the employee can submit their sheet" }, { status: 403 });
  }

  if (body.status === "approved" || body.status === "rejected") {
    if (user.role === "employee") {
      return NextResponse.json({ error: "Not authorized to approve/reject" }, { status: 403 });
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
  }

  if (body.status === "draft" && (sheet.status === "locked" || sheet.status === "approved")) {
    const { data: sheetGoals } = await supabase
      .from("goals")
      .select("id")
      .eq("goal_sheet_id", body.id);

    const hasNoGoals = !sheetGoals || sheetGoals.length === 0;
    const isOwner = sheet.employee_id === user.id;

    if (!hasNoGoals && user.role !== "admin") {
      return NextResponse.json({ error: "Only Admin/HR can unlock approved/locked goal sheets" }, { status: 403 });
    }
    if (hasNoGoals && !isOwner && user.role !== "admin") {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }
  }

  const updateData: Record<string, unknown> = {};
  if (body.status) updateData.status = body.status;

  if (body.status === "submitted" || body.status === "approved") {
    const { data: goals } = await supabase
      .from("goals")
      .select("weightage")
      .eq("goal_sheet_id", body.id);

    if (!goals || goals.length === 0) {
      return NextResponse.json({ error: "No goals in sheet" }, { status: 400 });
    }

    if (goals.length > 8) {
      return NextResponse.json({ error: "Maximum 8 goals allowed per employee" }, { status: 400 });
    }

    const totalWeightage = goals.reduce((sum, g) => sum + g.weightage, 0);
    if (totalWeightage !== 100) {
      return NextResponse.json(
        { error: `Total weightage must be 100% (currently ${totalWeightage}%)` },
        { status: 400 }
      );
    }

    const underWeight = goals.find((g) => g.weightage < 10);
    if (underWeight) {
      return NextResponse.json(
        { error: "Each goal must have at least 10% weightage" },
        { status: 400 }
      );
    }
  }

  if (body.status === "submitted") {
    updateData.submitted_at = new Date().toISOString();

    await supabase
      .from("goals")
      .update({ status: "submitted" })
      .eq("goal_sheet_id", body.id);

    const { data: employee } = await supabase
      .from("users")
      .select("name, email, manager_id")
      .eq("id", sheet.employee_id)
      .single();

    if (employee?.manager_id) {
      const { data: manager } = await supabase
        .from("users")
        .select("id, name, email")
        .eq("id", employee.manager_id)
        .single();

      if (manager) {
        const { count } = await supabase
          .from("goals")
          .select("id", { count: "exact", head: true })
          .eq("goal_sheet_id", body.id);

        notifyGoalSubmitted({
          employeeName: employee.name,
          employeeEmail: employee.email,
          managerEmail: manager.email,
          managerName: manager.name,
          goalCount: count || 0,
          goalSheetId: body.id,
          managerId: manager.id,
        }).catch((err) => console.error("[Notify] goalSubmitted error:", err));
      }
    }
  }

  if (body.status === "approved") {
    updateData.approved_at = new Date().toISOString();
    updateData.approved_by = user.id;

    await supabase
      .from("goals")
      .update({ status: "locked" })
      .eq("goal_sheet_id", body.id);

    await supabase.from("audit_logs").insert({
      entity_type: "goal_sheet",
      entity_id: body.id,
      user_id: user.id,
      action: "approve",
      field_changed: "status",
      old_value: sheet.status,
      new_value: "approved",
    });

    const { data: employee } = await supabase
      .from("users")
      .select("name, email")
      .eq("id", sheet.employee_id)
      .single();

    const { data: cycle } = await supabase
      .from("cycles")
      .select("name")
      .eq("id", sheet.cycle_id)
      .single();

    if (employee) {
      notifyGoalApproved({
        employeeName: employee.name,
        employeeEmail: employee.email,
        employeeId: sheet.employee_id,
        cycleName: cycle?.name || "Current Cycle",
      }).catch((err) => console.error("[Notify] goalApproved error:", err));
    }
  }

  if (body.status === "rejected") {
    if (body.reject_reason) {
      updateData.reject_reason = body.reject_reason;
    }

    await supabase
      .from("goals")
      .update({ status: "draft" })
      .eq("goal_sheet_id", body.id);

    await supabase.from("audit_logs").insert({
      entity_type: "goal_sheet",
      entity_id: body.id,
      user_id: user.id,
      action: "reject",
      field_changed: "status",
      old_value: sheet.status,
      new_value: "rejected",
    });

    const { data: employee } = await supabase
      .from("users")
      .select("name, email")
      .eq("id", sheet.employee_id)
      .single();

    if (employee) {
      notifyGoalRejected({
        employeeName: employee.name,
        employeeEmail: employee.email,
        employeeId: sheet.employee_id,
        reason: body.reject_reason || null,
      }).catch((err) => console.error("[Notify] goalRejected error:", err));
    }
  }

  if (body.status === "draft" && (sheet.status === "locked" || sheet.status === "approved")) {
    await supabase
      .from("goals")
      .update({ status: "draft" })
      .eq("goal_sheet_id", body.id);

    updateData.approved_at = null;
    updateData.approved_by = null;
    updateData.reject_reason = null;

    await supabase.from("audit_logs").insert({
      entity_type: "goal_sheet",
      entity_id: body.id,
      user_id: user.id,
      action: "unlock",
      field_changed: "status",
      old_value: sheet.status,
      new_value: "draft",
    });
  }

  const { data, error } = await supabase
    .from("goal_sheets")
    .update(updateData)
    .eq("id", body.id)
    .select("*, goals(*, thrust_area:thrust_areas(*))")
    .single();

  if (error) {
    console.error("Goal sheets PUT error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (data) {
    const { data: emp } = await supabase
      .from("users")
      .select("*")
      .eq("id", data.employee_id)
      .single();
    (data as Record<string, unknown>).employee = emp;
  }

  return NextResponse.json({ goalSheet: data });
  } catch (err) {
    console.error("[goal-sheets:PUT]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
