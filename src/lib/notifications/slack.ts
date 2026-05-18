import { createAdminClient } from "@/lib/supabase/admin";

function isValidWebhookUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      (url.hostname === "hooks.slack.com" || url.hostname.endsWith(".slack.com"))
    );
  } catch {
    return false;
  }
}

async function getWebhookUrl(): Promise<string | null> {
  const envUrl = process.env.SLACK_WEBHOOK_URL;

  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "slack_webhook_url")
      .single();

    if (data?.value && data.value.trim() !== "" && isValidWebhookUrl(data.value.trim())) {
      return data.value.trim();
    }
  } catch {
    // DB lookup failed — fall back to env
  }

  if (envUrl && isValidWebhookUrl(envUrl)) {
    return envUrl;
  }

  return null;
}

export async function sendSlackNotification(
  message: Record<string, unknown>
): Promise<{ success: boolean; error?: string }> {
  const webhookUrl = await getWebhookUrl();
  if (!webhookUrl) {
    console.warn("[Slack] No valid webhook URL configured — skipping notification");
    return { success: false, error: "Slack webhook URL not configured or invalid" };
  }

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(message),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "Unknown error");
      console.error(`[Slack] Webhook returned ${res.status}: ${text}`);
      return { success: false, error: `Webhook returned ${res.status}` };
    }
    return { success: true };
  } catch (err) {
    console.error("[Slack] Unexpected error:", err);
    return { success: false, error: String(err) };
  }
}
