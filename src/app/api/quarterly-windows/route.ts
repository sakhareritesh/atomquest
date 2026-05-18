import { NextRequest, NextResponse } from "next/server";
import { getUser, requireRole, parseJson } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  const user = await getUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createAdminClient();
  const { searchParams } = new URL(request.url);
  const cycleId = searchParams.get("cycle_id");

  let query = supabase.from("quarterly_windows").select("*").order("quarter");
  if (cycleId) query = query.eq("cycle_id", cycleId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ windows: data });
}

export async function PUT(request: NextRequest) {
  const { user, error: authError } = await requireRole(request, ["admin"]);
  if (authError) return authError;

  const body = await parseJson(request);
  if (!body?.id || !body?.status) {
    return NextResponse.json({ error: "id and status are required" }, { status: 400 });
  }

  if (body.status !== "open" && body.status !== "closed") {
    return NextResponse.json({ error: "status must be 'open' or 'closed'" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: existing } = await supabase
    .from("quarterly_windows")
    .select("*")
    .eq("id", body.id)
    .single();

  if (!existing) {
    return NextResponse.json({ error: "Quarterly window not found" }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("quarterly_windows")
    .update({ status: body.status })
    .eq("id", body.id)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase.from("audit_logs").insert({
    entity_type: "quarterly_window",
    entity_id: body.id,
    user_id: user.id,
    action: "update",
    field_changed: "status",
    old_value: existing.status,
    new_value: body.status,
  });

  return NextResponse.json({ window: data });
}
