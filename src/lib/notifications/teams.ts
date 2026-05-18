import { createAdminClient } from "@/lib/supabase/admin";

async function getWebhookUrl(): Promise<string | null> {
  const envUrl = process.env.TEAMS_WEBHOOK_URL;

  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "teams_webhook_url")
      .single();

    if (data?.value && data.value.trim() !== "") {
      return data.value.trim();
    }
  } catch {
    // DB lookup failed — fall back to env
  }

  return envUrl || null;
}

export async function sendTeamsNotification(
  card: Record<string, unknown>
): Promise<{ success: boolean; error?: string }> {
  const webhookUrl = await getWebhookUrl();
  if (!webhookUrl) {
    console.warn("[Teams] No webhook URL configured — skipping notification");
    return { success: false, error: "Teams webhook URL not configured" };
  }

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(card),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "Unknown error");
      console.error(`[Teams] Webhook returned ${res.status}: ${text}`);
      return { success: false, error: `Webhook returned ${res.status}` };
    }
    return { success: true };
  } catch (err) {
    console.error("[Teams] Unexpected error:", err);
    return { success: false, error: String(err) };
  }
}
