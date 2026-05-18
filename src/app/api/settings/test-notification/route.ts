import { NextRequest, NextResponse } from "next/server";
import { requireRole, parseJson } from "@/lib/api-auth";
import { sendEmail } from "@/lib/notifications/email";
import { sendSlackNotification } from "@/lib/notifications/slack";
import { goalApprovedCard } from "@/lib/notifications/templates";

export async function POST(request: NextRequest) {
  try {
  const { user, error: authError } = await requireRole(request, ["admin"]);
  if (authError) return authError;

  const body = await parseJson(request);
  const channel = body?.channel;

  if (channel === "email") {
    const email = user.email as string;
    const result = await sendEmail({
      to: email,
      subject: "GoalTracker Test Email",
      html: `
        <div style="font-family:sans-serif;padding:20px;">
          <h2 style="color:#2563eb;">GoalTracker Email Test</h2>
          <p>This is a test email from GoalTracker.</p>
          <p>If you received this, your email integration is working correctly.</p>
          <p style="color:#6b7280;font-size:12px;margin-top:20px;">Sent to: ${email}</p>
        </div>
      `,
      fromName: "GoalTracker Test",
    });

    return NextResponse.json({
      success: result.success,
      message: result.success
        ? `Test email sent to ${email}`
        : `Email failed: ${result.error}`,
    });
  }

  if (channel === "slack") {
    const card = goalApprovedCard(
      "Test Employee",
      "FY 2026-27 (Test)",
      process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
    );

    const result = await sendSlackNotification(card);

    return NextResponse.json({
      success: result.success,
      message: result.success
        ? "Test notification sent to Slack channel"
        : `Slack failed: ${result.error}`,
    });
  }

  return NextResponse.json({ error: "Invalid channel. Use 'email' or 'slack'." }, { status: 400 });
  } catch (err) {
    console.error("[test-notification]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
