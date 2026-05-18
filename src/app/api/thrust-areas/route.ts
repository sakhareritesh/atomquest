import { NextRequest, NextResponse } from "next/server";
import { getUser, requireRole, parseJson } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  const user = await getUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("thrust_areas")
    .select("*")
    .order("name");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ thrustAreas: data });
}

export async function POST(request: NextRequest) {
  const { error: authError } = await requireRole(request, ["admin"]);
  if (authError) return authError;

  const body = await parseJson(request);
  if (!body?.name) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("thrust_areas")
    .insert({
      name: body.name,
      description: body.description || "",
      department: body.department || "All",
      is_active: true,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ thrustArea: data }, { status: 201 });
}

export async function PUT(request: NextRequest) {
  const { error: authError } = await requireRole(request, ["admin"]);
  if (authError) return authError;

  const body = await parseJson(request);
  if (!body?.id) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const supabase = createAdminClient();

  const updateData: Record<string, unknown> = {};
  if (body.name !== undefined) updateData.name = body.name;
  if (body.description !== undefined) updateData.description = body.description;
  if (body.department !== undefined) updateData.department = body.department;
  if (body.is_active !== undefined) updateData.is_active = body.is_active;

  const { data, error } = await supabase
    .from("thrust_areas")
    .update(updateData)
    .eq("id", body.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ thrustArea: data });
}
