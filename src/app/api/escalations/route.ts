import { NextRequest, NextResponse } from "next/server";
import { requireRole, parseJson } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createEscalationNotifications } from "@/lib/utils/create-notifications";
import { notifyEscalation } from "@/lib/notifications";

const ESCALATION_SELECT =
  "*, target_user:users!escalations_target_user_id_fkey(id, name, email, role, department, manager_id)";

export async function GET(request: NextRequest) {
  const { user, error: authError } = await requireRole(request, ["admin", "employee", "manager"]);
  if (authError) return authError;

  const supabase = createAdminClient();
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");

  let query = supabase
    .from("escalations")
    .select(ESCALATION_SELECT)
    .order("triggered_at", { ascending: false });

  // Non-admins only see escalations targeting them
  if (user.role !== "admin") {
    query = query.eq("target_user_id", user.id);
  }

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ escalations: data || [] });
}

export async function POST(request: NextRequest) {
  const { user, error: authError } = await requireRole(request, ["admin"]);
  if (authError) return authError;

  const body = await parseJson(request);
  if (!body?.rule_type || !body?.target_user_id) {
    return NextResponse.json({ error: "rule_type and target_user_id are required" }, { status: 400 });
  }

  const validRuleTypes = ["goal_not_submitted", "approval_pending", "checkin_missing", "achievement_not_updated"];
  if (!validRuleTypes.includes(body.rule_type)) {
    return NextResponse.json({ error: "Invalid rule type" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: targetUser } = await supabase
    .from("users")
    .select("id, name, email, role, department, manager_id")
    .eq("id", body.target_user_id)
    .single();

  if (!targetUser) {
    return NextResponse.json({ error: "Target user not found" }, { status: 404 });
  }

  // Look up manager name for audit purposes
  let managerName: string | null = null;
  if (targetUser.manager_id) {
    const { data: manager } = await supabase
      .from("users")
      .select("name")
      .eq("id", targetUser.manager_id)
      .single();
    managerName = manager?.name || null;
  }

  const { data, error } = await supabase
    .from("escalations")
    .insert({
      rule_type: body.rule_type,
      target_user_id: body.target_user_id,
      escalation_level: body.escalation_level || 1,
      status: "pending",
      message: body.message || null,
      deadline: body.deadline || null,
      created_by: user.id,
      violation_id: body.violation_id || null,
    })
    .select(ESCALATION_SELECT)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Mark the violation as escalated if linked
  if (body.violation_id) {
    await supabase
      .from("escalation_violations")
      .update({ is_escalated: true })
      .eq("id", body.violation_id);
  }

  // Auto-create notifications based on escalation level and target role
  const notificationIds = await createEscalationNotifications(supabase, {
    id: data.id,
    rule_type: body.rule_type,
    target_user_id: body.target_user_id,
    escalation_level: body.escalation_level || 1,
    message: body.message || null,
    deadline: body.deadline || null,
  }, {
    id: targetUser.id,
    name: targetUser.name,
    role: targetUser.role,
    manager_id: targetUser.manager_id,
  });

  await supabase.from("audit_logs").insert({
    entity_type: "escalation",
    entity_id: data.id,
    user_id: user.id,
    action: "create",
    field_changed: "status",
    old_value: null,
    new_value: `pending (level ${body.escalation_level || 1}, ${notificationIds.length} notifications sent${managerName ? `, manager: ${managerName}` : ""})`,
  });

  const RULE_LABELS: Record<string, string> = {
    goal_not_submitted: "Goal Not Submitted",
    approval_pending: "Approval Pending Too Long",
    checkin_missing: "Check-in Not Completed",
    achievement_not_updated: "Achievement Not Updated",
  };

  const recipientEmails: string[] = [targetUser.email];
  if (targetUser.manager_id) {
    const { data: mgr } = await supabase
      .from("users")
      .select("email")
      .eq("id", targetUser.manager_id)
      .single();
    if (mgr?.email) recipientEmails.push(mgr.email);
  }

  notifyEscalation({
    targetName: targetUser.name,
    targetEmail: targetUser.email,
    ruleLabel: RULE_LABELS[body.rule_type] || body.rule_type,
    message: body.message || null,
    deadline: body.deadline || null,
    link: targetUser.role === "manager" ? "/manager/team" : "/employee/goals",
    recipientEmails,
  }).catch((err) => console.error("[Notify] escalation error:", err));

  return NextResponse.json({ escalation: data, notifications_sent: notificationIds.length }, { status: 201 });
}

export async function PUT(request: NextRequest) {
  const { user, error: authError } = await requireRole(request, ["admin"]);
  if (authError) return authError;

  const body = await parseJson(request);
  if (!body?.id) {
    return NextResponse.json({ error: "Escalation id is required" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: existing } = await supabase
    .from("escalations")
    .select("*")
    .eq("id", body.id)
    .single();

  if (!existing) {
    return NextResponse.json({ error: "Escalation not found" }, { status: 404 });
  }

  if (existing.status === "resolved") {
    return NextResponse.json({ error: "Escalation is already resolved" }, { status: 400 });
  }

  const newStatus = body.status || "resolved";
  const updateData: Record<string, unknown> = { status: newStatus };
  if (newStatus === "resolved") {
    updateData.resolved_at = new Date().toISOString();
  }

  // Support re-escalation (bump level)
  if (body.escalation_level && body.escalation_level > existing.escalation_level) {
    updateData.escalation_level = body.escalation_level;
    updateData.status = "escalated";

    const { data: targetUser } = await supabase
      .from("users")
      .select("id, name, role, manager_id")
      .eq("id", existing.target_user_id)
      .single();

    if (targetUser) {
      await createEscalationNotifications(supabase, {
        id: existing.id,
        rule_type: existing.rule_type,
        target_user_id: existing.target_user_id,
        escalation_level: body.escalation_level,
        message: existing.message,
        deadline: existing.deadline,
      }, targetUser);
    }
  }

  const { data, error } = await supabase
    .from("escalations")
    .update(updateData)
    .eq("id", body.id)
    .select(ESCALATION_SELECT)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase.from("audit_logs").insert({
    entity_type: "escalation",
    entity_id: body.id,
    user_id: user.id,
    action: newStatus === "resolved" ? "resolve" : "update",
    field_changed: "status",
    old_value: existing.status,
    new_value: updateData.status || newStatus,
  });

  return NextResponse.json({ escalation: data });
}
