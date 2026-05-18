import { NextRequest, NextResponse } from "next/server";
import { requireRole, parseJson } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";

const ALLOWED_KEYS = [
  "email_notifications_enabled",
  "teams_notifications_enabled",
  "teams_webhook_url",
  "email_from_name",
  "app_base_url",
];

export async function GET(request: NextRequest) {
  const { error: authError } = await requireRole(request, ["admin"]);
  if (authError) return authError;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("app_settings")
    .select("key, value")
    .in("key", ALLOWED_KEYS);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const settings: Record<string, string> = {};
  for (const row of data || []) {
    settings[row.key] = row.key === "teams_webhook_url" ? maskUrl(row.value) : row.value;
  }

  const hasResendKey = !!process.env.RESEND_API_KEY;
  const hasTeamsEnvUrl = !!process.env.TEAMS_WEBHOOK_URL;

  return NextResponse.json({ settings, hasResendKey, hasTeamsEnvUrl });
}

export async function PUT(request: NextRequest) {
  const { error: authError } = await requireRole(request, ["admin"]);
  if (authError) return authError;

  const body = await parseJson(request);
  if (!body?.settings || typeof body.settings !== "object") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const supabase = createAdminClient();

  for (const [key, value] of Object.entries(body.settings)) {
    if (!ALLOWED_KEYS.includes(key)) continue;
    if (typeof value !== "string") continue;

    await supabase
      .from("app_settings")
      .upsert(
        { key, value, updated_at: new Date().toISOString() },
        { onConflict: "key" }
      );
  }

  return NextResponse.json({ success: true });
}

function maskUrl(url: string): string {
  if (!url || url.trim() === "") return "";
  try {
    const parsed = new URL(url);
    const path = parsed.pathname;
    return `${parsed.origin}${path.substring(0, 20)}...`;
  } catch {
    return url.substring(0, 30) + "...";
  }
}
