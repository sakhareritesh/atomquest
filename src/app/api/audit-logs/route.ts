import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";

function safeInt(value: string | null, fallback: number, max?: number): number {
  if (!value) return fallback;
  const parsed = parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return max ? Math.min(parsed, max) : parsed;
}

function sanitizeFilter(input: string): string {
  return input.replace(/[%,().*]/g, "");
}

export async function GET(request: NextRequest) {
  try {
    const { error: authError } = await requireRole(request, ["admin"]);
    if (authError) return authError;

    const supabase = createAdminClient();
    const { searchParams } = new URL(request.url);
    const limit = safeInt(searchParams.get("limit"), 100, 500);
    const offset = safeInt(searchParams.get("offset"), 0);
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
      const safe = sanitizeFilter(search);
      if (safe.length > 0) {
        query = query.or(
          `field_changed.ilike.%${safe}%,old_value.ilike.%${safe}%,new_value.ilike.%${safe}%`
        );
      }
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
  } catch (err) {
    console.error("[audit-logs] Unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
