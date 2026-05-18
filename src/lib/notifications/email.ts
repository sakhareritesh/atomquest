import { Resend } from "resend";

let resendClient: Resend | null = null;

function getClient(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null;
  if (!resendClient) {
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }
  return resendClient;
}

export async function sendEmail(params: {
  to: string | string[];
  subject: string;
  html: string;
  fromName?: string;
}): Promise<{ success: boolean; error?: string }> {
  const client = getClient();
  if (!client) {
    console.warn("[Email] RESEND_API_KEY not configured — skipping email");
    return { success: false, error: "RESEND_API_KEY not configured" };
  }

  try {
    const { error } = await client.emails.send({
      from: `${params.fromName || "GoalTracker"} <onboarding@resend.dev>`,
      to: Array.isArray(params.to) ? params.to : [params.to],
      subject: params.subject,
      html: params.html,
    });

    if (error) {
      console.error("[Email] Resend error:", error);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err) {
    console.error("[Email] Unexpected error:", err);
    return { success: false, error: String(err) };
  }
}
