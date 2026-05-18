import { NextRequest, NextResponse } from "next/server";
import { getUser, requireRole, parseJson } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncQuarterlyWindows } from "@/lib/utils/sync-windows";

export async function GET(request: NextRequest) {
  const user = await getUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await syncQuarterlyWindows();

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("cycles")
    .select("*, quarterly_windows(*)")
    .order("year", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ cycles: data });
}

export async function POST(request: NextRequest) {
  const { user, error: authError } = await requireRole(request, ["admin"]);
  if (authError) return authError;

  const body = await parseJson(request);
  if (!body?.name || !body?.year || !body?.goal_setting_start || !body?.goal_setting_end) {
    return NextResponse.json({ error: "name, year, goal_setting_start, and goal_setting_end are required" }, { status: 400 });
  }

  const supabase = createAdminClient();

  await supabase
    .from("cycles")
    .update({ status: "closed" })
    .eq("status", "active");

  const { data: cycle, error } = await supabase
    .from("cycles")
    .insert({
      name: body.name,
      year: Number(body.year),
      goal_setting_start: body.goal_setting_start,
      goal_setting_end: body.goal_setting_end,
      status: "active",
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (body.windows && Array.isArray(body.windows)) {
    const windows = body.windows.map((w: { quarter: string; window_open: string; window_close: string }) => ({
      cycle_id: cycle.id,
      quarter: w.quarter,
      window_open: w.window_open,
      window_close: w.window_close,
      status: "closed",
    }));
    const { error: winError } = await supabase.from("quarterly_windows").insert(windows);
    if (winError) {
      console.error("Failed to create quarterly windows:", winError.message);
    }
  }

  await supabase.from("audit_logs").insert({
    entity_type: "cycle",
    entity_id: cycle.id,
    user_id: user.id,
    action: "create",
    field_changed: "cycle",
    old_value: "",
    new_value: cycle.name,
  });

  return NextResponse.json({ cycle }, { status: 201 });
}

export async function PUT(request: NextRequest) {
  const { user, error: authError } = await requireRole(request, ["admin"]);
  if (authError) return authError;

  const body = await parseJson(request);
  if (!body?.id) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const supabase = createAdminClient();

  const { data: oldCycle } = await supabase
    .from("cycles")
    .select("*")
    .eq("id", body.id)
    .single();

  const updateData: Record<string, unknown> = {};
  if (body.name) updateData.name = body.name;
  if (body.status) updateData.status = body.status;
  if (body.goal_setting_start) updateData.goal_setting_start = body.goal_setting_start;
  if (body.goal_setting_end) updateData.goal_setting_end = body.goal_setting_end;

  if (body.status === "active") {
    await supabase
      .from("cycles")
      .update({ status: "closed" })
      .eq("status", "active")
      .neq("id", body.id);
  }

  const { data, error } = await supabase
    .from("cycles")
    .update(updateData)
    .eq("id", body.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (body.status && oldCycle && body.status !== oldCycle.status) {
    await supabase.from("audit_logs").insert({
      entity_type: "cycle",
      entity_id: body.id,
      user_id: user.id,
      action: "update",
      field_changed: "status",
      old_value: oldCycle.status,
      new_value: body.status,
    });
  }

  return NextResponse.json({ cycle: data });
}
