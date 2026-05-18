import { NextRequest, NextResponse } from "next/server";
import { requireRole, getUser, parseJson } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { sharedGoalCreateSchema } from "@/lib/validations/goal";

export async function GET(request: NextRequest) {
  const user = await getUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (user.role !== "manager" && user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = createAdminClient();
  const { searchParams } = new URL(request.url);
  const cycleId = searchParams.get("cycle_id");

  let primaryQuery = supabase
    .from("goals")
    .select("*, thrust_area:thrust_areas(*)")
    .eq("is_primary_owner", true);

  if (user.role === "manager") {
    primaryQuery = primaryQuery.eq("employee_id", user.id);
  }
  if (cycleId) {
    primaryQuery = primaryQuery.eq("cycle_id", cycleId);
  }

  const { data: primaryGoals, error: pErr } = await primaryQuery.order("created_at", { ascending: false });
  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });

  const sharedKpis = [];
  for (const pg of primaryGoals || []) {
    const { data: linked } = await supabase
      .from("goals")
      .select("id, employee_id, weightage, status")
      .eq("shared_goal_id", pg.id);

    if (linked && linked.length > 0) {
      const employeeIds = linked.map((l: { employee_id: string }) => l.employee_id);
      const { data: employees } = await supabase
        .from("users")
        .select("id, name, department")
        .in("id", employeeIds);

      const linkedWithNames = linked.map((l: { id: string; employee_id: string; weightage: number; status: string }) => {
        const emp = employees?.find((e: { id: string }) => e.id === l.employee_id);
        return { ...l, employee_name: emp?.name || "Unknown", department: emp?.department || "" };
      });

      sharedKpis.push({ ...pg, linked_goals: linkedWithNames });
    }
  }

  return NextResponse.json({ sharedKpis });
}

export async function POST(request: NextRequest) {
  const { user, error: authError } = await requireRole(request, ["admin", "manager"]);
  if (authError) return authError;

  const body = await parseJson(request);

  if (body?.primary_goal_id) {
    return handleLegacyPush(user, body);
  }

  return handleCreateKpi(user, body);
}

async function handleCreateKpi(user: { id: string; role: string }, body: Record<string, unknown>) {
  const parsed = sharedGoalCreateSchema.safeParse(body);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message || "Validation failed";
    return NextResponse.json({ error: firstError, issues: parsed.error.issues }, { status: 400 });
  }

  const { thrust_area_id, title, description, uom_type, target_value, target_date, cycle_id, employee_ids } = parsed.data;
  const supabase = createAdminClient();

  const { data: cycle } = await supabase
    .from("cycles")
    .select("id, status")
    .eq("id", cycle_id)
    .single();
  if (!cycle) return NextResponse.json({ error: "Invalid cycle" }, { status: 400 });
  if (cycle.status !== "active") return NextResponse.json({ error: "Cycle is not active" }, { status: 400 });

  const { data: ta } = await supabase
    .from("thrust_areas")
    .select("id")
    .eq("id", thrust_area_id)
    .eq("is_active", true)
    .single();
  if (!ta) return NextResponse.json({ error: "Invalid or inactive thrust area" }, { status: 400 });

  if (user.role === "manager") {
    for (const empId of employee_ids) {
      const { data: report } = await supabase
        .from("users")
        .select("id")
        .eq("id", empId)
        .eq("manager_id", user.id)
        .single();
      if (!report) {
        return NextResponse.json({ error: `Employee is not your direct report` }, { status: 403 });
      }
    }
  }

  let { data: managerSheet } = await supabase
    .from("goal_sheets")
    .select("*")
    .eq("employee_id", user.id)
    .eq("cycle_id", cycle_id)
    .single();

  if (!managerSheet) {
    const { data: newSheet } = await supabase
      .from("goal_sheets")
      .insert({ employee_id: user.id, cycle_id, status: "draft" })
      .select()
      .single();
    managerSheet = newSheet;
  }

  if (!managerSheet) {
    return NextResponse.json({ error: "Failed to create manager goal sheet" }, { status: 500 });
  }

  const { data: masterGoal, error: masterErr } = await supabase
    .from("goals")
    .insert({
      employee_id: user.id,
      cycle_id,
      goal_sheet_id: managerSheet.id,
      thrust_area_id,
      title,
      description: description || "",
      uom_type,
      target_value: target_value ?? null,
      target_date: target_date ?? null,
      weightage: 10,
      status: "locked",
      is_primary_owner: true,
      shared_goal_id: null,
    })
    .select("*, thrust_area:thrust_areas(*)")
    .single();

  if (masterErr || !masterGoal) {
    return NextResponse.json({ error: masterErr?.message || "Failed to create master KPI" }, { status: 500 });
  }

  const created: unknown[] = [];
  const skipped: string[] = [];
  const lockedSkipped: string[] = [];

  for (const empId of employee_ids) {
    const { data: empUser } = await supabase
      .from("users")
      .select("name")
      .eq("id", empId)
      .single();
    const empName = empUser?.name || empId;

    const { data: existingLinked } = await supabase
      .from("goals")
      .select("id")
      .eq("employee_id", empId)
      .eq("shared_goal_id", masterGoal.id)
      .limit(1);

    if (existingLinked && existingLinked.length > 0) {
      skipped.push(empName);
      continue;
    }

    let { data: sheet } = await supabase
      .from("goal_sheets")
      .select("*")
      .eq("employee_id", empId)
      .eq("cycle_id", cycle_id)
      .single();

    if (sheet && (sheet.status === "locked" || sheet.status === "approved")) {
      lockedSkipped.push(empName);
      continue;
    }

    if (!sheet) {
      const { data: newSheet } = await supabase
        .from("goal_sheets")
        .insert({ employee_id: empId, cycle_id, status: "draft" })
        .select()
        .single();
      sheet = newSheet;
    }

    if (!sheet) continue;

    const { data: sheetGoals } = await supabase
      .from("goals")
      .select("id")
      .eq("goal_sheet_id", sheet.id);

    if (sheetGoals && sheetGoals.length >= 8) {
      lockedSkipped.push(`${empName} (max 8 goals)`);
      continue;
    }

    const { data: goal, error } = await supabase
      .from("goals")
      .insert({
        employee_id: empId,
        cycle_id,
        goal_sheet_id: sheet.id,
        thrust_area_id,
        title,
        description: description || "",
        uom_type,
        target_value: target_value ?? null,
        target_date: target_date ?? null,
        weightage: 10,
        status: "draft",
        shared_goal_id: masterGoal.id,
        is_primary_owner: false,
      })
      .select()
      .single();

    if (!error && goal) created.push(goal);
  }

  return NextResponse.json(
    {
      masterGoal,
      created,
      count: created.length,
      skipped,
      skippedCount: skipped.length,
      lockedSkipped,
      lockedSkippedCount: lockedSkipped.length,
    },
    { status: 201 }
  );
}

async function handleLegacyPush(user: { id: string; role: string }, body: Record<string, unknown>) {
  if (!body?.primary_goal_id || !Array.isArray(body?.employee_ids) || !body?.cycle_id) {
    return NextResponse.json(
      { error: "primary_goal_id, employee_ids, and cycle_id are required" },
      { status: 400 }
    );
  }

  const { primary_goal_id, employee_ids, cycle_id } = body as {
    primary_goal_id: string;
    employee_ids: string[];
    cycle_id: string;
  };
  const supabase = createAdminClient();

  const { data: cycle } = await supabase
    .from("cycles")
    .select("id")
    .eq("id", cycle_id)
    .single();
  if (!cycle) {
    return NextResponse.json({ error: "Invalid cycle" }, { status: 400 });
  }

  const { data: primaryGoal } = await supabase
    .from("goals")
    .select("*")
    .eq("id", primary_goal_id)
    .single();

  if (!primaryGoal) {
    return NextResponse.json({ error: "Primary goal not found" }, { status: 404 });
  }

  if (primaryGoal.status !== "locked" && primaryGoal.status !== "approved") {
    return NextResponse.json(
      { error: "Only locked/approved goals can be shared. Get the goal approved first." },
      { status: 400 }
    );
  }

  if (user.role === "manager") {
    const goalOwnerId = primaryGoal.employee_id;
    if (goalOwnerId !== user.id) {
      const { data: goalOwnerReport } = await supabase
        .from("users")
        .select("id")
        .eq("id", goalOwnerId)
        .eq("manager_id", user.id)
        .single();
      if (!goalOwnerReport) {
        return NextResponse.json(
          { error: "Primary goal does not belong to you or your team" },
          { status: 403 }
        );
      }
    }

    for (const empId of employee_ids) {
      const { data: report } = await supabase
        .from("users")
        .select("id")
        .eq("id", empId)
        .eq("manager_id", user.id)
        .single();
      if (!report) {
        return NextResponse.json(
          { error: `User ${empId} is not your direct report` },
          { status: 403 }
        );
      }
    }
  }

  const created: unknown[] = [];
  const skipped: string[] = [];
  const lockedSkipped: string[] = [];

  for (const empId of employee_ids) {
    const { data: empUser } = await supabase
      .from("users")
      .select("name")
      .eq("id", empId)
      .single();
    const empName = empUser?.name || empId;

    const { data: existingLinked } = await supabase
      .from("goals")
      .select("id")
      .eq("employee_id", empId)
      .eq("shared_goal_id", primary_goal_id)
      .limit(1);

    if (existingLinked && existingLinked.length > 0) {
      skipped.push(empName);
      continue;
    }

    let { data: sheet } = await supabase
      .from("goal_sheets")
      .select("*")
      .eq("employee_id", empId)
      .eq("cycle_id", cycle_id)
      .single();

    if (sheet && (sheet.status === "locked" || sheet.status === "approved")) {
      lockedSkipped.push(empName);
      continue;
    }

    if (!sheet) {
      const { data: newSheet } = await supabase
        .from("goal_sheets")
        .insert({
          employee_id: empId,
          cycle_id: cycle_id,
          status: "draft",
        })
        .select()
        .single();
      sheet = newSheet;
    }

    if (!sheet) continue;

    const { data: sheetGoals } = await supabase
      .from("goals")
      .select("id")
      .eq("goal_sheet_id", sheet.id);

    if (sheetGoals && sheetGoals.length >= 8) {
      lockedSkipped.push(`${empName} (max 8 goals)`);
      continue;
    }

    const { data: goal, error } = await supabase
      .from("goals")
      .insert({
        employee_id: empId,
        cycle_id: cycle_id,
        goal_sheet_id: sheet.id,
        thrust_area_id: primaryGoal.thrust_area_id,
        title: primaryGoal.title,
        description: primaryGoal.description,
        uom_type: primaryGoal.uom_type,
        target_value: primaryGoal.target_value,
        target_date: primaryGoal.target_date,
        weightage: 10,
        status: "draft",
        shared_goal_id: primary_goal_id,
        is_primary_owner: false,
      })
      .select()
      .single();

    if (!error && goal) created.push(goal);
  }

  return NextResponse.json(
    {
      created,
      count: created.length,
      skipped,
      skippedCount: skipped.length,
      lockedSkipped,
      lockedSkippedCount: lockedSkipped.length,
    },
    { status: 201 }
  );
}
