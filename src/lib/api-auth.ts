import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { UserRole } from "@/types";

export async function getUser(request: NextRequest) {
  const token = request.cookies.get("firebase-token")?.value;
  if (!token) return null;
  try {
    const { adminAuth } = await import("@/lib/firebase-admin");
    const decoded = await adminAuth.verifyIdToken(token);
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("users")
      .select("*")
      .eq("firebase_uid", decoded.uid)
      .single();
    return data;
  } catch {
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
  if (!allowedRoles.includes(user.role as UserRole)) {
    return {
      user: null,
      error: NextResponse.json(
        { error: `Access denied. Required role: ${allowedRoles.join(" or ")}` },
        { status: 403 }
      ),
    };
  }
  return { user, error: null };
}

export function parseJson(request: NextRequest) {
  return request.json().catch(() => null);
}
