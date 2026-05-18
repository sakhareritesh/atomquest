import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  const { error: authError } = await requireRole(request, ["admin"]);
  if (authError) return authError;

  const supabase = createAdminClient();
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get("limit") || "100");
  const offset = parseInt(searchParams.get("offset") || "0");
  const entityType = searchParams.get("entity_type");
  const action = searchParams.get("action");
  const search = searchParams.get("search");
  const userId = searchParams.get("user_id");
  const dateFrom = searchParams.get("date_from");
  const dateTo = searchParams.get("date_to");

  let query = supabase
    .from("audit_logs")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false });

  if (entityType) query = query.eq("entity_type", entityType);
  if (action) query = query.eq("action", action);
  if (userId) query = query.eq("user_id", userId);
  if (dateFrom) query = query.gte("created_at", dateFrom);
  if (dateTo) query = query.lte("created_at", dateTo + "T23:59:59.999Z");

  if (search) {
    query = query.or(
      `field_changed.ilike.%${search}%,old_value.ilike.%${search}%,new_value.ilike.%${search}%`
    );
  }

  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (data && data.length > 0) {
    const userIds = [...new Set(data.map((l) => l.user_id).filter(Boolean))];
    if (userIds.length > 0) {
      const { data: users } = await supabase
        .from("users")
        .select("id, name, email, role, department")
        .in("id", userIds);
      const userMap = new Map((users || []).map((u) => [u.id, u]));
      for (const log of data) {
        (log as Record<string, unknown>).user = log.user_id ? userMap.get(log.user_id) || null : null;
      }
    }
  }

  return NextResponse.json({ auditLogs: data, total: count });
}
