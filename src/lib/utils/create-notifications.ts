import type { SupabaseClient } from "@supabase/supabase-js";

const RULE_LABELS: Record<string, string> = {
  goal_not_submitted: "Goal Not Submitted",
  approval_pending: "Approval Pending Too Long",
  checkin_missing: "Check-in Not Completed",
  achievement_not_updated: "Achievement Not Updated",
};

const RULE_LINKS: Record<string, { employee: string; manager: string }> = {
  goal_not_submitted: { employee: "/employee/goals", manager: "/manager/team" },
  approval_pending: { employee: "/employee/goals", manager: "/manager/approvals" },
  checkin_missing: { employee: "/employee/goals", manager: "/manager/checkins" },
  achievement_not_updated: { employee: "/employee/achievements", manager: "/manager/team" },
};

interface EscalationInput {
  id: string;
  rule_type: string;
  target_user_id: string;
  escalation_level: number;
  message: string | null;
  deadline: string | null;
}

interface TargetUser {
  id: string;
  name: string;
  role: string;
  manager_id: string | null;
}

export async function createEscalationNotifications(
  supabase: SupabaseClient,
  escalation: EscalationInput,
  targetUser: TargetUser
) {
  const ruleLabel = RULE_LABELS[escalation.rule_type] || escalation.rule_type;
  const deadlineStr = escalation.deadline
    ? ` Deadline: ${new Date(escalation.deadline).toLocaleDateString()}.`
    : "";
  const customMsg = escalation.message ? ` "${escalation.message}"` : "";

  const notifications: Array<{
    user_id: string;
    type: string;
    title: string;
    message: string;
    link: string | null;
    escalation_id: string;
  }> = [];

  if (targetUser.role === "employee" || escalation.escalation_level === 1) {
    // Notify the employee
    notifications.push({
      user_id: escalation.target_user_id,
      type: "escalation_reminder",
      title: `Action Required: ${ruleLabel}`,
      message: `You have a pending escalation for "${ruleLabel}".${customMsg}${deadlineStr} Please take action immediately.`,
      link: RULE_LINKS[escalation.rule_type]?.employee || "/employee/goals",
      escalation_id: escalation.id,
    });

    // Notify the employee's manager
    if (targetUser.manager_id) {
      notifications.push({
        user_id: targetUser.manager_id,
        type: "team_escalation",
        title: `Team Escalation: ${targetUser.name}`,
        message: `${targetUser.name} has been escalated for "${ruleLabel}".${customMsg}${deadlineStr}`,
        link: RULE_LINKS[escalation.rule_type]?.manager || "/manager/team",
        escalation_id: escalation.id,
      });
    }
  }

  if (targetUser.role === "manager" || escalation.escalation_level === 2) {
    // Notify the manager directly
    if (!notifications.find((n) => n.user_id === escalation.target_user_id)) {
      notifications.push({
        user_id: escalation.target_user_id,
        type: "escalation_reminder",
        title: `Action Required: ${ruleLabel}`,
        message: `You have a pending escalation for "${ruleLabel}".${customMsg}${deadlineStr} Please take action immediately.`,
        link: RULE_LINKS[escalation.rule_type]?.manager || "/manager/team",
        escalation_id: escalation.id,
      });
    }

    // Notify all admins about manager escalation
    const { data: admins } = await supabase
      .from("users")
      .select("id")
      .eq("role", "admin");

    for (const admin of admins || []) {
      notifications.push({
        user_id: admin.id,
        type: "admin_escalation_alert",
        title: `Manager Escalated: ${targetUser.name}`,
        message: `Manager ${targetUser.name} has been escalated for "${ruleLabel}".${customMsg}${deadlineStr}`,
        link: "/admin/escalations",
        escalation_id: escalation.id,
      });
    }
  }

  if (escalation.escalation_level >= 3) {
    // Level 3: notify employee, manager, and all admins
    if (!notifications.find((n) => n.user_id === escalation.target_user_id)) {
      notifications.push({
        user_id: escalation.target_user_id,
        type: "escalation_reminder",
        title: `Urgent Escalation: ${ruleLabel}`,
        message: `Critical escalation raised for "${ruleLabel}".${customMsg}${deadlineStr} Immediate action required.`,
        link: RULE_LINKS[escalation.rule_type]?.employee || "/employee/goals",
        escalation_id: escalation.id,
      });
    }

    if (targetUser.manager_id && !notifications.find((n) => n.user_id === targetUser.manager_id)) {
      notifications.push({
        user_id: targetUser.manager_id,
        type: "team_escalation",
        title: `Urgent Team Escalation: ${targetUser.name}`,
        message: `Critical escalation for ${targetUser.name}: "${ruleLabel}".${customMsg}${deadlineStr}`,
        link: RULE_LINKS[escalation.rule_type]?.manager || "/manager/team",
        escalation_id: escalation.id,
      });
    }

    const { data: admins } = await supabase
      .from("users")
      .select("id")
      .eq("role", "admin");

    for (const admin of admins || []) {
      if (!notifications.find((n) => n.user_id === admin.id)) {
        notifications.push({
          user_id: admin.id,
          type: "admin_escalation_alert",
          title: `Skip-Level Escalation: ${targetUser.name}`,
          message: `Skip-level escalation for ${targetUser.name}: "${ruleLabel}".${customMsg}${deadlineStr}`,
          link: "/admin/escalations",
          escalation_id: escalation.id,
        });
      }
    }
  }

  if (notifications.length === 0) return [];

  const { data, error } = await supabase
    .from("notifications")
    .insert(notifications)
    .select("id");

  if (error) {
    console.error("Failed to create notifications:", error);
    return [];
  }

  return data || [];
}

export function getNotificationRecipientPreview(
  targetUserRole: string,
  targetUserName: string,
  managerName: string | null,
  escalationLevel: number
): string[] {
  const recipients: string[] = [];

  if (targetUserRole === "employee" || escalationLevel === 1) {
    recipients.push(targetUserName);
    if (managerName) recipients.push(`Manager: ${managerName}`);
  }

  if (targetUserRole === "manager" || escalationLevel === 2) {
    if (!recipients.includes(targetUserName)) recipients.push(targetUserName);
    recipients.push("All Admins");
  }

  if (escalationLevel >= 3) {
    if (!recipients.includes(targetUserName)) recipients.push(targetUserName);
    if (managerName && !recipients.find((r) => r.includes(managerName))) {
      recipients.push(`Manager: ${managerName}`);
    }
    if (!recipients.includes("All Admins")) recipients.push("All Admins");
  }

  return recipients;
}
