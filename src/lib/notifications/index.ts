import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "./email";
import { sendSlackNotification } from "./slack";
import * as templates from "./templates";

async function getSettings(): Promise<Record<string, string>> {
  try {
    const supabase = createAdminClient();
    const { data } = await supabase.from("app_settings").select("key, value");
    const map: Record<string, string> = {};
    for (const row of data || []) {
      map[row.key] = row.value;
    }
    return map;
  } catch {
    return {};
  }
}

function getBaseUrl(settings: Record<string, string>): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    settings.app_base_url ||
    "http://localhost:3000"
  );
}

// ─── Goal Sheet Submitted ────────────────────────────────────────────

export async function notifyGoalSubmitted(params: {
  employeeName: string;
  employeeEmail: string;
  managerEmail: string;
  managerName: string;
  goalCount: number;
  goalSheetId: string;
  managerId: string;
}) {
  const settings = await getSettings();
  const baseUrl = getBaseUrl(settings);

  const inAppPromise = createInAppNotification({
    userId: params.managerId,
    type: "goal_submitted",
    title: `Goal Sheet Submitted: ${params.employeeName}`,
    message: `${params.employeeName} has submitted ${params.goalCount} goals for your review.`,
    link: "/manager/approvals",
  });

  const emailPromise =
    settings.email_notifications_enabled !== "false"
      ? (() => {
          const tpl = templates.goalSubmittedEmail(params.employeeName, params.goalCount, baseUrl);
          return sendEmail({
            to: params.managerEmail,
            subject: tpl.subject,
            html: tpl.html,
            fromName: settings.email_from_name,
          });
        })()
      : Promise.resolve({ success: false, error: "disabled" });

  const slackPromise =
    settings.slack_notifications_enabled !== "false"
      ? sendSlackNotification(
          templates.goalSubmittedCard(params.employeeName, params.goalCount, `${baseUrl}/manager/approvals`)
        )
      : Promise.resolve({ success: false, error: "disabled" });

  const [inApp, email, slack] = await Promise.allSettled([inAppPromise, emailPromise, slackPromise]);
  logResults("goalSubmitted", inApp, email, slack);
}

// ─── Goal Sheet Approved ─────────────────────────────────────────────

export async function notifyGoalApproved(params: {
  employeeName: string;
  employeeEmail: string;
  employeeId: string;
  cycleName: string;
}) {
  const settings = await getSettings();
  const baseUrl = getBaseUrl(settings);

  const inAppPromise = createInAppNotification({
    userId: params.employeeId,
    type: "goal_approved",
    title: "Your Goal Sheet Has Been Approved!",
    message: `Your goal sheet for ${params.cycleName} has been approved and locked.`,
    link: "/employee/goals",
  });

  const emailPromise =
    settings.email_notifications_enabled !== "false"
      ? (() => {
          const tpl = templates.goalApprovedEmail(params.employeeName, params.cycleName, baseUrl);
          return sendEmail({
            to: params.employeeEmail,
            subject: tpl.subject,
            html: tpl.html,
            fromName: settings.email_from_name,
          });
        })()
      : Promise.resolve({ success: false, error: "disabled" });

  const slackPromise =
    settings.slack_notifications_enabled !== "false"
      ? sendSlackNotification(
          templates.goalApprovedCard(params.employeeName, params.cycleName, `${baseUrl}/employee/goals`)
        )
      : Promise.resolve({ success: false, error: "disabled" });

  const [inApp, email, slack] = await Promise.allSettled([inAppPromise, emailPromise, slackPromise]);
  logResults("goalApproved", inApp, email, slack);
}

// ─── Goal Sheet Rejected ─────────────────────────────────────────────

export async function notifyGoalRejected(params: {
  employeeName: string;
  employeeEmail: string;
  employeeId: string;
  reason: string | null;
}) {
  const settings = await getSettings();
  const baseUrl = getBaseUrl(settings);

  const inAppPromise = createInAppNotification({
    userId: params.employeeId,
    type: "goal_rejected",
    title: "Goal Sheet Returned for Rework",
    message: params.reason
      ? `Your goal sheet was returned: ${params.reason}`
      : "Your goal sheet was returned for revision. Please update and resubmit.",
    link: "/employee/goals",
  });

  const emailPromise =
    settings.email_notifications_enabled !== "false"
      ? (() => {
          const tpl = templates.goalRejectedEmail(params.employeeName, params.reason, baseUrl);
          return sendEmail({
            to: params.employeeEmail,
            subject: tpl.subject,
            html: tpl.html,
            fromName: settings.email_from_name,
          });
        })()
      : Promise.resolve({ success: false, error: "disabled" });

  const slackPromise =
    settings.slack_notifications_enabled !== "false"
      ? sendSlackNotification(
          templates.goalRejectedCard(params.employeeName, params.reason, `${baseUrl}/employee/goals`)
        )
      : Promise.resolve({ success: false, error: "disabled" });

  const [inApp, email, slack] = await Promise.allSettled([inAppPromise, emailPromise, slackPromise]);
  logResults("goalRejected", inApp, email, slack);
}

// ─── Escalation Created ──────────────────────────────────────────────

export async function notifyEscalation(params: {
  targetName: string;
  targetEmail: string;
  ruleLabel: string;
  message: string | null;
  deadline: string | null;
  link: string;
  recipientEmails: string[];
}) {
  const settings = await getSettings();
  const baseUrl = getBaseUrl(settings);

  const emailPromise =
    settings.email_notifications_enabled !== "false" && params.recipientEmails.length > 0
      ? (() => {
          const tpl = templates.escalationEmail(
            params.targetName,
            params.ruleLabel,
            params.message,
            params.deadline,
            params.link,
            baseUrl
          );
          return sendEmail({
            to: params.recipientEmails,
            subject: tpl.subject,
            html: tpl.html,
            fromName: settings.email_from_name,
          });
        })()
      : Promise.resolve({ success: false, error: "disabled" });

  const slackPromise =
    settings.slack_notifications_enabled !== "false"
      ? sendSlackNotification(
          templates.escalationCard(
            params.targetName,
            params.ruleLabel,
            params.message,
            params.deadline,
            `${baseUrl}${params.link}`
          )
        )
      : Promise.resolve({ success: false, error: "disabled" });

  const [email, slack] = await Promise.allSettled([emailPromise, slackPromise]);
  logResults("escalation", { status: "fulfilled", value: [] }, email, slack);
}

// ─── Check-in Reminder ───────────────────────────────────────────────

export async function notifyCheckinReminder(params: {
  managerName: string;
  managerEmail: string;
  teamMembers: string[];
  quarter: string;
}) {
  const settings = await getSettings();
  const baseUrl = getBaseUrl(settings);

  const emailPromise =
    settings.email_notifications_enabled !== "false"
      ? (() => {
          const tpl = templates.checkinReminderEmail(
            params.managerName,
            params.teamMembers,
            params.quarter,
            baseUrl
          );
          return sendEmail({
            to: params.managerEmail,
            subject: tpl.subject,
            html: tpl.html,
            fromName: settings.email_from_name,
          });
        })()
      : Promise.resolve({ success: false, error: "disabled" });

  const slackPromise =
    settings.slack_notifications_enabled !== "false"
      ? sendSlackNotification(
          templates.checkinReminderCard(
            params.managerName,
            params.teamMembers,
            params.quarter,
            `${baseUrl}/manager/checkins`
          )
        )
      : Promise.resolve({ success: false, error: "disabled" });

  const [email, slack] = await Promise.allSettled([emailPromise, slackPromise]);
  logResults("checkinReminder", { status: "fulfilled", value: [] }, email, slack);
}

// ─── Helpers ─────────────────────────────────────────────────────────

async function createInAppNotification(params: {
  userId: string;
  type: string;
  title: string;
  message: string;
  link: string;
  escalationId?: string;
}) {
  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from("notifications").insert({
      user_id: params.userId,
      type: params.type,
      title: params.title,
      message: params.message,
      link: params.link,
      escalation_id: params.escalationId || null,
    });
    if (error) console.error("[InApp] Insert error:", error);
    return { success: !error };
  } catch (err) {
    console.error("[InApp] Unexpected error:", err);
    return { success: false };
  }
}

function logResults(
  event: string,
  inApp: PromiseSettledResult<unknown>,
  email: PromiseSettledResult<unknown>,
  slack: PromiseSettledResult<unknown>
) {
  const status = (r: PromiseSettledResult<unknown>) =>
    r.status === "fulfilled" ? "ok" : `failed: ${(r as PromiseRejectedResult).reason}`;
  console.log(`[Notify:${event}] inApp=${status(inApp)} email=${status(email)} slack=${status(slack)}`);
}
