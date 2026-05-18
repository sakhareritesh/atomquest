import { NextRequest, NextResponse } from "next/server";
import { getUser, requireRole, parseJson } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  try {
  const user = await getUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createAdminClient();
  const { searchParams } = new URL(request.url);
  const role = searchParams.get("role");
  const managerId = searchParams.get("manager_id");

  let query = supabase.from("users").select("*");

  if (user.role === "employee") {
    query = query.eq("id", user.id);
  } else if (user.role === "manager") {
    if (managerId && managerId !== user.id) {
      return NextResponse.json({ error: "Can only view your own reports" }, { status: 403 });
    }
    query = query.or(`manager_id.eq.${user.id},id.eq.${user.id}`);
  }

  if (role) query = query.eq("role", role);

  const { data, error } = await query.order("name");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ users: data });
  } catch (err) {
    console.error("[users:GET]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
  const { user, error: authError } = await requireRole(request, ["admin"]);
  if (authError) return authError;

  const body = await parseJson(request);
  if (!body?.id) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const supabase = createAdminClient();

  const { data: oldUser } = await supabase
    .from("users")
    .select("*")
    .eq("id", body.id)
    .single();

  if (!oldUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const validRoles = ["employee", "manager", "admin"];
  if (body.role && !validRoles.includes(body.role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  const updateData: Record<string, unknown> = {};
  if (body.name) updateData.name = body.name;
  if (body.role) updateData.role = body.role;
  if (body.department) updateData.department = body.department;
  if (body.designation) updateData.designation = body.designation;
  if (body.manager_id !== undefined) updateData.manager_id = body.manager_id;

  const { data, error } = await supabase
    .from("users")
    .update(updateData)
    .eq("id", body.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (body.role && body.role !== oldUser.role) {
    await supabase.from("audit_logs").insert({
      entity_type: "user",
      entity_id: body.id,
      user_id: user.id,
      action: "role_change",
      field_changed: "role",
      old_value: oldUser.role,
      new_value: body.role,
    });
  }

  if (body.manager_id !== undefined && body.manager_id !== oldUser.manager_id) {
    await supabase.from("audit_logs").insert({
      entity_type: "user",
      entity_id: body.id,
      user_id: user.id,
      action: "hierarchy_change",
      field_changed: "manager_id",
      old_value: oldUser.manager_id || "none",
      new_value: body.manager_id || "none",
    });
  }

  return NextResponse.json({ user: data });
  } catch (err) {
    console.error("[users:PUT]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
