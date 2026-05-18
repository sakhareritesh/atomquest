import { NextRequest, NextResponse } from "next/server";
import { getUser, requireRole, parseJson } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  try {
  const user = await getUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("thrust_areas")
    .select("*")
    .order("name");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ thrustAreas: data });
  } catch (err) {
    console.error("[thrust-areas:GET]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
  const { error: authError } = await requireRole(request, ["admin"]);
  if (authError) return authError;

  const body = await parseJson(request);
  if (!body?.name || typeof body.name !== "string" || body.name.trim().length < 2) {
    return NextResponse.json({ error: "Name is required (min 2 characters)" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("thrust_areas")
    .insert({
      name: body.name.trim(),
      description: (body.description || "").trim(),
      department: (body.department || "All").trim(),
      is_active: true,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ thrustArea: data }, { status: 201 });
  } catch (err) {
    console.error("[thrust-areas:POST]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
  const { error: authError } = await requireRole(request, ["admin"]);
  if (authError) return authError;

  const body = await parseJson(request);
  if (!body?.id) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const supabase = createAdminClient();

  const updateData: Record<string, unknown> = {};
  if (body.name !== undefined) updateData.name = typeof body.name === "string" ? body.name.trim() : body.name;
  if (body.description !== undefined) updateData.description = typeof body.description === "string" ? body.description.trim() : body.description;
  if (body.department !== undefined) updateData.department = typeof body.department === "string" ? body.department.trim() : body.department;
  if (body.is_active !== undefined) updateData.is_active = body.is_active;

  const { data, error } = await supabase
    .from("thrust_areas")
    .update(updateData)
    .eq("id", body.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ thrustArea: data });
  } catch (err) {
    console.error("[thrust-areas:PUT]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
