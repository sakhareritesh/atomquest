import { NextRequest, NextResponse } from "next/server";
import { getUser, parseJson } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeScore } from "@/lib/utils/score-calculator";

export async function GET(request: NextRequest) {
  const user = await getUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createAdminClient();
  const { searchParams } = new URL(request.url);
  const goalId = searchParams.get("goal_id");
  const requestedEmployeeId = searchParams.get("employee_id");
  const cycleId = searchParams.get("cycle_id");

  if (goalId) {
    const { data: goal } = await supabase
      .from("goals")
      .select("employee_id")
      .eq("id", goalId)
      .single();

    if (!goal) return NextResponse.json({ error: "Goal not found" }, { status: 404 });

    if (user.role === "employee" && goal.employee_id !== user.id) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    if (user.role === "manager" && goal.employee_id !== user.id) {
      const { data: report } = await supabase
        .from("users")
        .select("id")
        .eq("id", goal.employee_id)
        .eq("manager_id", user.id)
        .single();
      if (!report) {
        return NextResponse.json({ error: "Not your report's goal" }, { status: 403 });
      }
    }

    const { data, error } = await supabase
      .from("achievements")
      .select("*, goal:goals(*, thrust_area:thrust_areas(*))")
      .eq("goal_id", goalId)
      .order("quarter");

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ achievements: data });
  }

  let employeeId = user.id;
  if (requestedEmployeeId && requestedEmployeeId !== user.id) {
    if (user.role === "admin") {
      employeeId = requestedEmployeeId;
    } else if (user.role === "manager") {
      const { data: report } = await supabase
        .from("users")
        .select("id")
        .eq("id", requestedEmployeeId)
        .eq("manager_id", user.id)
        .single();
      if (!report) return NextResponse.json({ error: "Not your report" }, { status: 403 });
      employeeId = requestedEmployeeId;
    } else {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }
  }

  let goalsQuery = supabase
    .from("goals")
    .select("id")
    .eq("employee_id", employeeId)
    .in("status", ["locked", "approved"]);

  if (cycleId) goalsQuery = goalsQuery.eq("cycle_id", cycleId);

  const { data: goals } = await goalsQuery;
  const goalIds = goals?.map((g) => g.id) || [];

  if (goalIds.length === 0) {
    return NextResponse.json({ achievements: [] });
  }

  const { data, error } = await supabase
    .from("achievements")
    .select("*, goal:goals(*, thrust_area:thrust_areas(*))")
    .in("goal_id", goalIds)
    .order("quarter");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ achievements: data });
}

export async function POST(request: NextRequest) {
  const user = await getUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await parseJson(request);
  if (!body?.goal_id || !body?.quarter) {
    return NextResponse.json({ error: "goal_id and quarter are required" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: goal } = await supabase
    .from("goals")
    .select("*")
    .eq("id", body.goal_id)
    .single();

  if (!goal) return NextResponse.json({ error: "Goal not found" }, { status: 404 });

  if (goal.status !== "locked" && goal.status !== "approved") {
    return NextResponse.json({ error: "Can only update achievements for locked/approved goals" }, { status: 400 });
  }

  if (user.role === "employee" && goal.employee_id !== user.id) {
    return NextResponse.json({ error: "Not your goal" }, { status: 403 });
  }

  if (user.role === "manager" && goal.employee_id !== user.id) {
    const { data: report } = await supabase
      .from("users")
      .select("id")
      .eq("id", goal.employee_id)
      .eq("manager_id", user.id)
      .single();
    if (!report) {
      return NextResponse.json({ error: "Not your report's goal" }, { status: 403 });
    }
  }

  if (user.role !== "admin") {
    const { data: window } = await supabase
      .from("quarterly_windows")
      .select("*")
      .eq("cycle_id", goal.cycle_id)
      .eq("quarter", body.quarter)
      .single();

    if (!window) {
      return NextResponse.json(
        { error: `No quarterly window configured for ${body.quarter}` },
        { status: 403 }
      );
    }

    const now = new Date();
    const windowOpen = new Date(window.window_open);
    const windowClose = new Date(window.window_close);
    if (window.status !== "open" || now < windowOpen || now > windowClose) {
      return NextResponse.json(
        { error: `The quarterly window for ${body.quarter} is not currently open` },
        { status: 403 }
      );
    }
  }

  // Fetch existing achievement for audit diff
  const { data: existingAch } = await supabase
    .from("achievements")
    .select("*")
    .eq("goal_id", body.goal_id)
    .eq("quarter", body.quarter)
    .single();

  const isTimeline = goal.uom_type === "timeline";
  const completionDate = isTimeline ? (body.completion_date || null) : null;

  const score = computeScore(
    goal.uom_type,
    goal.target_value,
    isTimeline ? null : body.actual_achievement,
    goal.target_date,
    completionDate
  );

  const actualValue = isTimeline ? 0 : (body.actual_achievement ?? 0);
  const plannedTarget = body.planned_target != null ? body.planned_target : goal.target_value;

  let progressStatus: string = body.progress_status || "not_started";

  if (isTimeline && completionDate) {
    const deadline = new Date(goal.target_date!);
    const completed = new Date(completionDate);
    progressStatus = completed <= deadline ? "completed" : "on_track";
  } else if (goal.uom_type === "zero") {
    if (actualValue === 0) {
      progressStatus = "completed";
    }
  } else if (!isTimeline && score >= 100) {
    progressStatus = "completed";
  }

  const { data, error } = await supabase
    .from("achievements")
    .upsert(
      {
        goal_id: body.goal_id,
        quarter: body.quarter,
        planned_target: plannedTarget,
        actual_achievement: actualValue,
        progress_status: progressStatus,
        computed_score: score,
        completion_date: completionDate,
        updated_by: user.id,
      },
      { onConflict: "goal_id,quarter" }
    )
    .select("*, goal:goals(*, thrust_area:thrust_areas(*))")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Audit log: track achievement changes
  const auditAction = existingAch ? "update" : "create";
  const auditFields: Array<{ field: string; old: string; new: string }> = [];

  if (existingAch) {
    if (existingAch.actual_achievement !== actualValue) {
      auditFields.push({
        field: "actual_achievement",
        old: String(existingAch.actual_achievement ?? ""),
        new: String(actualValue),
      });
    }
    if (existingAch.planned_target !== plannedTarget) {
      auditFields.push({
        field: "planned_target",
        old: String(existingAch.planned_target ?? ""),
        new: String(plannedTarget),
      });
    }
    if (existingAch.computed_score !== score) {
      auditFields.push({
        field: "computed_score",
        old: String(existingAch.computed_score ?? ""),
        new: String(score),
      });
    }
    if (existingAch.progress_status !== progressStatus) {
      auditFields.push({
        field: "progress_status",
        old: existingAch.progress_status,
        new: progressStatus,
      });
    }
    if (isTimeline && String(existingAch.completion_date || "") !== String(completionDate || "")) {
      auditFields.push({
        field: "completion_date",
        old: String(existingAch.completion_date || ""),
        new: String(completionDate || ""),
      });
    }
  }

  if (auditFields.length > 0 || auditAction === "create") {
    const logEntries = auditAction === "create"
      ? [{
          entity_type: "achievement",
          entity_id: data.id,
          user_id: user.id,
          action: "create",
          field_changed: `${body.quarter} achievement`,
          old_value: "",
          new_value: `actual=${actualValue}, planned=${plannedTarget}, score=${score}, status=${progressStatus}`,
        }]
      : auditFields.map((f) => ({
          entity_type: "achievement",
          entity_id: data.id,
          user_id: user.id,
          action: "update",
          field_changed: `${body.quarter} ${f.field}`,
          old_value: f.old,
          new_value: f.new,
        }));

    await supabase.from("audit_logs").insert(logEntries);
  }

  return NextResponse.json({ achievement: data });
}
