const BRAND_COLOR = "#2563eb";
const MUTED_COLOR = "#6b7280";

function layout(title: string, body: string, ctaText: string, ctaUrl: string): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
        <tr><td style="background:${BRAND_COLOR};padding:24px 32px;">
          <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:600;">GoalTracker</h1>
        </td></tr>
        <tr><td style="padding:32px;">
          <h2 style="margin:0 0 16px;color:#111827;font-size:18px;">${title}</h2>
          <div style="color:#374151;font-size:14px;line-height:1.6;">${body}</div>
          <div style="margin:24px 0;">
            <a href="${ctaUrl}" style="display:inline-block;background:${BRAND_COLOR};color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:6px;font-size:14px;font-weight:500;">${ctaText}</a>
          </div>
        </td></tr>
        <tr><td style="padding:16px 32px;border-top:1px solid #e5e7eb;">
          <p style="margin:0;color:${MUTED_COLOR};font-size:12px;">This is an automated notification from GoalTracker. Do not reply to this email.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export function goalSubmittedEmail(employeeName: string, goalCount: number, baseUrl: string): { subject: string; html: string } {
  return {
    subject: `Goal Sheet Submitted: ${employeeName}`,
    html: layout(
      "New Goal Sheet Awaiting Your Approval",
      `<p><strong>${employeeName}</strong> has submitted their goal sheet with <strong>${goalCount} goals</strong> for your review.</p>
       <p>Please review the goals, adjust weightages if needed, and approve or return for rework.</p>`,
      "Review Now",
      `${baseUrl}/manager/approvals`
    ),
  };
}

export function goalApprovedEmail(employeeName: string, cycleName: string, baseUrl: string): { subject: string; html: string } {
  return {
    subject: `Your Goals Have Been Approved — ${cycleName}`,
    html: layout(
      "Your Goal Sheet Has Been Approved!",
      `<p>Great news, <strong>${employeeName}</strong>! Your goal sheet for <strong>${cycleName}</strong> has been approved and locked.</p>
       <p>You can now start tracking your achievements against these goals.</p>`,
      "View My Goals",
      `${baseUrl}/employee/goals`
    ),
  };
}

export function goalRejectedEmail(employeeName: string, reason: string | null, baseUrl: string): { subject: string; html: string } {
  const reasonBlock = reason
    ? `<div style="background:#fef2f2;border-left:4px solid #ef4444;padding:12px 16px;margin:16px 0;border-radius:0 4px 4px 0;">
         <p style="margin:0;color:#991b1b;font-size:13px;font-weight:500;">Reason for return:</p>
         <p style="margin:4px 0 0;color:#7f1d1d;font-size:13px;">${reason}</p>
       </div>`
    : "";
  return {
    subject: "Your Goal Sheet Needs Revision",
    html: layout(
      "Goal Sheet Returned for Rework",
      `<p><strong>${employeeName}</strong>, your manager has returned your goal sheet for revision.</p>
       ${reasonBlock}
       <p>Please make the necessary changes and resubmit.</p>`,
      "Edit My Goals",
      `${baseUrl}/employee/goals`
    ),
  };
}

export function escalationEmail(
  targetName: string,
  ruleLabel: string,
  message: string | null,
  deadline: string | null,
  link: string,
  baseUrl: string
): { subject: string; html: string } {
  const deadlineBlock = deadline
    ? `<p>Deadline: <strong>${new Date(deadline).toLocaleDateString()}</strong></p>`
    : "";
  const messageBlock = message
    ? `<p style="color:${MUTED_COLOR};font-style:italic;">"${message}"</p>`
    : "";
  return {
    subject: `Escalation: ${ruleLabel} — ${targetName}`,
    html: layout(
      `Escalation Alert: ${ruleLabel}`,
      `<p>An escalation has been raised for <strong>${targetName}</strong> regarding <strong>${ruleLabel}</strong>.</p>
       ${messageBlock}${deadlineBlock}
       <p>Please take action as soon as possible.</p>`,
      "Take Action",
      `${baseUrl}${link}`
    ),
  };
}

export function checkinReminderEmail(
  managerName: string,
  teamMembers: string[],
  quarter: string,
  baseUrl: string
): { subject: string; html: string } {
  const memberList = teamMembers.map((n) => `<li>${n}</li>`).join("");
  return {
    subject: `Check-in Reminder: ${quarter} Reviews Pending`,
    html: layout(
      `${quarter} Check-in Reminder`,
      `<p>Hi <strong>${managerName}</strong>, the following team members are awaiting their ${quarter} check-in:</p>
       <ul style="padding-left:20px;">${memberList}</ul>
       <p>Please complete the check-ins before the window closes.</p>`,
      "Go to Check-ins",
      `${baseUrl}/manager/checkins`
    ),
  };
}

// --- Slack Block Kit builders ---

export function goalSubmittedCard(employeeName: string, goalCount: number, deepLink: string) {
  return slackMessage(
    "New Goal Sheet Submitted",
    `*${employeeName}* has submitted their goal sheet with *${goalCount} goals* for your review.`,
    "Review Now",
    deepLink
  );
}

export function goalApprovedCard(employeeName: string, cycleName: string, deepLink: string) {
  return slackMessage(
    "Goal Sheet Approved",
    `*${employeeName}*'s goal sheet for *${cycleName}* has been approved and locked.`,
    "View Details",
    deepLink
  );
}

export function goalRejectedCard(employeeName: string, reason: string | null, deepLink: string) {
  const body = reason
    ? `*${employeeName}*'s goal sheet was returned for rework.\n\n_Reason: ${reason}_`
    : `*${employeeName}*'s goal sheet was returned for rework.`;
  return slackMessage("Goal Sheet Returned", body, "View Details", deepLink);
}

export function escalationCard(
  targetName: string,
  ruleLabel: string,
  message: string | null,
  deadline: string | null,
  deepLink: string
) {
  let body = `Escalation raised for *${targetName}*: *${ruleLabel}*.`;
  if (message) body += `\n\n_"${message}"_`;
  if (deadline) body += `\n\nDeadline: *${new Date(deadline).toLocaleDateString()}*`;
  return slackMessage("Escalation Alert", body, "Take Action", deepLink);
}

export function checkinReminderCard(managerName: string, teamMembers: string[], quarter: string, deepLink: string) {
  const memberList = teamMembers.map((n) => `• ${n}`).join("\n");
  return slackMessage(
    `${quarter} Check-in Reminder`,
    `Hi *${managerName}*, the following team members need their ${quarter} check-in:\n\n${memberList}`,
    "Go to Check-ins",
    deepLink
  );
}

function slackMessage(title: string, body: string, ctaText: string, ctaUrl: string) {
  return {
    blocks: [
      {
        type: "header",
        text: { type: "plain_text", text: title, emoji: true },
      },
      {
        type: "section",
        text: { type: "mrkdwn", text: body },
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: ctaText },
            url: ctaUrl,
            style: "primary",
          },
        ],
      },
    ],
  };
}
