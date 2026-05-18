export type UserRole = "employee" | "manager" | "admin";

export type GoalStatus = "draft" | "submitted" | "approved" | "rejected" | "locked";

export type UomType = "min_numeric" | "max_numeric" | "timeline" | "zero";

export type ProgressStatus = "not_started" | "on_track" | "completed";

export type Quarter = "Q1" | "Q2" | "Q3" | "Q4";

export type CycleStatus = "active" | "closed";

export interface User {
  id: string;
  firebase_uid: string;
  email: string;
  name: string;
  role: UserRole;
  manager_id: string | null;
  department: string;
  designation: string;
  created_at: string;
}

export interface Cycle {
  id: string;
  name: string;
  year: number;
  goal_setting_start: string;
  goal_setting_end: string;
  status: CycleStatus;
  created_at: string;
}

export interface QuarterlyWindow {
  id: string;
  cycle_id: string;
  quarter: Quarter;
  window_open: string;
  window_close: string;
  status: "open" | "closed";
}

export interface ThrustArea {
  id: string;
  name: string;
  description: string;
  department: string;
  is_active: boolean;
}

export interface Goal {
  id: string;
  employee_id: string;
  cycle_id: string;
  goal_sheet_id: string;
  thrust_area_id: string;
  title: string;
  description: string;
  uom_type: UomType;
  target_value: number | null;
  target_date: string | null;
  weightage: number;
  status: GoalStatus;
  shared_goal_id: string | null;
  is_primary_owner: boolean;
  created_at: string;
  updated_at: string;
  thrust_area?: ThrustArea;
  employee?: User;
}

export interface GoalSheet {
  id: string;
  employee_id: string;
  cycle_id: string;
  status: GoalStatus;
  submitted_at: string | null;
  approved_at: string | null;
  approved_by: string | null;
  reject_reason: string | null;
  employee?: User;
  goals?: Goal[];
  cycle?: Cycle;
}

export interface Achievement {
  id: string;
  goal_id: string;
  quarter: Quarter;
  planned_target: number | null;
  actual_achievement: number | null;
  progress_status: ProgressStatus;
  computed_score: number | null;
  completion_date: string | null;
  updated_at: string;
  updated_by: string;
  goal?: Goal;
}

export interface Checkin {
  id: string;
  goal_sheet_id: string;
  quarter: Quarter;
  manager_id: string;
  comment: string;
  created_at: string;
  manager?: User;
}

export interface AuditLog {
  id: string;
  entity_type: string;
  entity_id: string;
  user_id: string;
  action: string;
  field_changed: string;
  old_value: string;
  new_value: string;
  created_at: string;
  user?: User;
}

export interface EscalationViolation {
  id: string;
  rule_type: string;
  target_user_id: string;
  cycle_id: string;
  details: Record<string, unknown>;
  detected_at: string;
  is_escalated: boolean;
  target_user?: User;
}

export interface Escalation {
  id: string;
  rule_type: string;
  target_user_id: string;
  escalation_level: number;
  triggered_at: string;
  resolved_at: string | null;
  status: "pending" | "resolved" | "escalated";
  message: string | null;
  deadline: string | null;
  created_by: string | null;
  violation_id: string | null;
  target_user?: User;
  creator?: User;
}

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  escalation_id: string | null;
  is_read: boolean;
  created_at: string;
  escalation?: Escalation;
}

export interface AuthState {
  user: User | null;
  firebaseUid: string | null;
  loading: boolean;
  isAuthenticating: boolean;
  setUser: (user: User | null) => void;
  setFirebaseUid: (uid: string | null) => void;
  setLoading: (loading: boolean) => void;
  setIsAuthenticating: (v: boolean) => void;
  logout: () => void;
}
