import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { UserRole } from "@/types";

const VALID_ROLES: UserRole[] = ["employee", "manager", "admin"];

export async function getUser(request: NextRequest) {
  const token = request.cookies.get("firebase-token")?.value;
  if (!token) return null;
  try {
    const { adminAuth } = await import("@/lib/firebase-admin");
    const decoded = await adminAuth.verifyIdToken(token);
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("firebase_uid", decoded.uid)
      .single();
    if (error) {
      console.error("[api-auth] Supabase user lookup failed:", error.message);
      return null;
    }
    return data;
  } catch (err) {
    console.error("[api-auth] Token verification failed:", err instanceof Error ? err.message : String(err));
    return null;
  }
}

export async function requireRole(
  request: NextRequest,
  allowedRoles: UserRole[]
): Promise<
  | { user: { id: string; role: UserRole; [key: string]: unknown }; error: null }
  | { user: null; error: NextResponse }
> {
  const user = await getUser(request);
  if (!user) {
    return { user: null, error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  const role = user.role as string;
  if (!VALID_ROLES.includes(role as UserRole) || !allowedRoles.includes(role as UserRole)) {
    return {
      user: null,
      error: NextResponse.json(
        { error: `Access denied. Required role: ${allowedRoles.join(" or ")}` },
        { status: 403 }
      ),
    };
  }
  return { user: { ...user, role: role as UserRole }, error: null };
}

export async function parseJson(request: NextRequest) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
