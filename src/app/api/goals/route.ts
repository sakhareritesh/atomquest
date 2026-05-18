import { NextRequest, NextResponse } from "next/server";
import { getUser, parseJson } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { goalSchema } from "@/lib/validations/goal";

export async function GET(request: NextRequest) {
  const user = await getUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createAdminClient();
  const { searchParams } = new URL(request.url);
  const cycleId = searchParams.get("cycle_id");
  const requestedEmployeeId = searchParams.get("employee_id");

  let employeeId = user.id;
  if (requestedEmployeeId && requestedEmployeeId !== user.id) {
    if (user.role === "admin") {
      employeeId = requestedEmployeeId;
    } else if (user.role === "manager") {
      const { data: report } = await supabase
        .from("users")
        .select("id")
        .eq("id", requestedEmployeeId)
        .eq("manager_id", user.id)
        .single();
      if (!report) return NextResponse.json({ error: "Not your report" }, { status: 403 });
      employeeId = requestedEmployeeId;
    } else {
      return NextResponse.json({ error: "Not authorized to view other employees' goals" }, { status: 403 });
    }
  }

  let query = supabase
    .from("goals")
    .select("*, thrust_area:thrust_areas(*)")
    .eq("employee_id", employeeId);

  if (cycleId) query = query.eq("cycle_id", cycleId);

  const { data, error } = await query.order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ goals: data });
}

export async function POST(request: NextRequest) {
  const user = await getUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await parseJson(request);
  if (!body) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });

  const parsed = goalSchema.safeParse(body);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message || "Validation failed";
    return NextResponse.json({ error: firstError, issues: parsed.error.issues }, { status: 400 });
  }

  if (!body.cycle_id) {
    return NextResponse.json({ error: "Cycle ID is required" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: activeCycle } = await supabase
    .from("cycles")
    .select("id, status, goal_setting_start, goal_setting_end")
    .eq("id", body.cycle_id)
    .single();

  if (!activeCycle) {
    return NextResponse.json({ error: "Cycle not found" }, { status: 404 });
  }

  if (activeCycle.status !== "active") {
    return NextResponse.json({ error: "Cannot create goals in a closed cycle" }, { status: 400 });
  }

  const { data: goalSheet, error: sheetError } = await supabase
    .from("goal_sheets")
    .select("*")
    .eq("employee_id", user.id)
    .eq("cycle_id", body.cycle_id)
    .single();

  if (sheetError && sheetError.code !== "PGRST116") {
    return NextResponse.json({ error: sheetError.message }, { status: 500 });
  }

  let sheetId = goalSheet?.id;

  if (!goalSheet) {
    const { data: newSheet, error } = await supabase
      .from("goal_sheets")
      .insert({
        employee_id: user.id,
        cycle_id: body.cycle_id,
        status: "draft",
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    sheetId = newSheet.id;
  }

  if (goalSheet && (goalSheet.status === "locked" || goalSheet.status === "approved")) {
    const { data: sheetGoals } = await supabase
      .from("goals")
      .select("id")
      .eq("goal_sheet_id", goalSheet.id);

    if (!sheetGoals || sheetGoals.length === 0) {
      await supabase
        .from("goal_sheets")
        .update({ status: "draft", approved_at: null, approved_by: null, reject_reason: null })
        .eq("id", goalSheet.id);
    } else {
      return NextResponse.json({ error: "Goal sheet is locked. Contact Admin/HR to unlock." }, { status: 400 });
    }
  }

  const { data: existingGoals } = await supabase
    .from("goals")
    .select("id")
    .eq("goal_sheet_id", sheetId);

  if (existingGoals && existingGoals.length >= 8) {
    return NextResponse.json(
      { error: "Maximum 8 goals allowed per employee" },
      { status: 400 }
    );
  }

  const { data: goal, error } = await supabase
    .from("goals")
    .insert({
      employee_id: user.id,
      cycle_id: body.cycle_id,
      goal_sheet_id: sheetId,
      thrust_area_id: parsed.data.thrust_area_id,
      title: parsed.data.title,
      description: parsed.data.description,
      uom_type: parsed.data.uom_type,
      target_value: parsed.data.target_value ?? null,
      target_date: parsed.data.target_date ?? null,
      weightage: parsed.data.weightage,
      status: "draft",
      is_primary_owner: body.is_primary_owner ?? true,
      shared_goal_id: body.shared_goal_id ?? null,
    })
    .select("*, thrust_area:thrust_areas(*)")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ goal }, { status: 201 });
}

export async function PUT(request: NextRequest) {
  const user = await getUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await parseJson(request);
  if (!body?.id) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const supabase = createAdminClient();

  const { data: existing } = await supabase
    .from("goals")
    .select("*, goal_sheet:goal_sheets(*)")
    .eq("id", body.id)
    .single();

  if (!existing) return NextResponse.json({ error: "Goal not found" }, { status: 404 });

  if (existing.employee_id !== user.id && user.role === "employee") {
    return NextResponse.json({ error: "Not your goal" }, { status: 403 });
  }

  if (user.role === "manager" && existing.employee_id !== user.id) {
    const { data: report } = await supabase
      .from("users")
      .select("id")
      .eq("id", existing.employee_id)
      .eq("manager_id", user.id)
      .single();
    if (!report) return NextResponse.json({ error: "Not your report's goal" }, { status: 403 });
  }

  if (existing.status === "locked" && user.role !== "admin") {
    return NextResponse.json({ error: "Goal is locked. Contact Admin/HR to unlock." }, { status: 400 });
  }

  const isSharedRecipient = existing.shared_goal_id && !existing.is_primary_owner;

  if (isSharedRecipient) {
    const restrictedFields = ["title", "description", "thrust_area_id", "uom_type", "target_value", "target_date", "status"];
    for (const field of restrictedFields) {
      if (body[field] !== undefined) {
        return NextResponse.json(
          { error: "Shared goal recipients can only change weightage" },
          { status: 400 }
        );
      }
    }
  }

  if (body.weightage !== undefined) {
    const w = Number(body.weightage);
    if (isNaN(w) || w < 10 || w > 100) {
      return NextResponse.json({ error: "Weightage must be between 10% and 100%" }, { status: 400 });
    }
  }

  const updateData: Record<string, unknown> = {};
  if (body.title !== undefined) updateData.title = body.title;
  if (body.description !== undefined) updateData.description = body.description;
  if (body.thrust_area_id !== undefined) updateData.thrust_area_id = body.thrust_area_id;
  if (body.uom_type !== undefined) updateData.uom_type = body.uom_type;
  if (body.target_value !== undefined) updateData.target_value = body.target_value;
  if (body.target_date !== undefined) updateData.target_date = body.target_date;
  if (body.weightage !== undefined) updateData.weightage = Number(body.weightage);
  if (body.status !== undefined) updateData.status = body.status;

  const isLockedOrApproved = existing.status === "locked" || existing.status === "approved";
  if (isLockedOrApproved) {
    const auditFields: { field: string; oldVal: string; newVal: string }[] = [];
    if (body.title !== undefined && body.title !== existing.title) {
      auditFields.push({ field: "title", oldVal: existing.title, newVal: body.title });
    }
    if (body.target_value !== undefined && body.target_value !== existing.target_value) {
      auditFields.push({ field: "target_value", oldVal: String(existing.target_value ?? ""), newVal: String(body.target_value ?? "") });
    }
    if (body.weightage !== undefined && Number(body.weightage) !== existing.weightage) {
      auditFields.push({ field: "weightage", oldVal: String(existing.weightage), newVal: String(body.weightage) });
    }
    if (body.status !== undefined && body.status !== existing.status) {
      auditFields.push({ field: "status", oldVal: existing.status, newVal: body.status });
    }
    if (body.description !== undefined && body.description !== existing.description) {
      auditFields.push({ field: "description", oldVal: existing.description || "", newVal: body.description || "" });
    }
    if (body.uom_type !== undefined && body.uom_type !== existing.uom_type) {
      auditFields.push({ field: "uom_type", oldVal: existing.uom_type, newVal: body.uom_type });
    }
    if (body.target_date !== undefined && body.target_date !== existing.target_date) {
      auditFields.push({ field: "target_date", oldVal: existing.target_date || "", newVal: body.target_date || "" });
    }

    for (const af of auditFields) {
      await supabase.from("audit_logs").insert({
        entity_type: "goal",
        entity_id: body.id,
        user_id: user.id,
        action: "update",
        field_changed: af.field,
        old_value: af.oldVal,
        new_value: af.newVal,
      });
    }
  }

  const { data: goal, error } = await supabase
    .from("goals")
    .update(updateData)
    .eq("id", body.id)
    .select("*, thrust_area:thrust_areas(*)")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ goal });
}

export async function DELETE(request: NextRequest) {
  const user = await getUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const goalId = searchParams.get("id");
  if (!goalId) return NextResponse.json({ error: "Goal ID required" }, { status: 400 });

  const supabase = createAdminClient();

  const { data: existing } = await supabase
    .from("goals")
    .select("*")
    .eq("id", goalId)
    .single();

  if (!existing) return NextResponse.json({ error: "Goal not found" }, { status: 404 });

  if (existing.employee_id !== user.id && user.role !== "admin") {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  if (existing.shared_goal_id && !existing.is_primary_owner && user.role !== "admin") {
    return NextResponse.json({ error: "Cannot delete a shared goal assigned by your manager" }, { status: 400 });
  }

  if (existing.status === "locked" || existing.status === "approved") {
    if (user.role !== "admin") {
      return NextResponse.json({ error: "Cannot delete locked/approved goal. Contact Admin/HR." }, { status: 400 });
    }

    await supabase.from("audit_logs").insert({
      entity_type: "goal",
      entity_id: goalId,
      user_id: user.id,
      action: "admin_delete",
      field_changed: "status",
      old_value: existing.status,
      new_value: "deleted",
    });
  }

  const { error } = await supabase.from("goals").delete().eq("id", goalId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
