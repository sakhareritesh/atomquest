import { NextRequest, NextResponse } from "next/server";
import { requireRole, parseJson } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  try {
  const { user, error: authError } = await requireRole(request, ["employee", "manager", "admin"]);
  if (authError) return authError;

  const supabase = createAdminClient();
  const { searchParams } = new URL(request.url);
  const rawLimit = parseInt(searchParams.get("limit") || "20", 10);
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 100) : 20;
  const unreadOnly = searchParams.get("unread_only") === "true";

  let query = supabase
    .from("notifications")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (unreadOnly) {
    query = query.eq("is_read", false);
  }

  const { data: notifications, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { count: unreadCount } = await supabase
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("is_read", false);

  return NextResponse.json({
    notifications: notifications || [],
    unread_count: unreadCount || 0,
  });
  } catch (err) {
    console.error("[notifications:GET]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
  const { user, error: authError } = await requireRole(request, ["employee", "manager", "admin"]);
  if (authError) return authError;

  const body = await parseJson(request);
  if (!body) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Mark specific notification(s) as read
  if (body.notification_id) {
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", body.notification_id)
      .eq("user_id", user.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  // Mark all as read
  if (body.mark_all_read) {
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", user.id)
      .eq("is_read", false);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Provide notification_id or mark_all_read" }, { status: 400 });
  } catch (err) {
    console.error("[notifications:PUT]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
