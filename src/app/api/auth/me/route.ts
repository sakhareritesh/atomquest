import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get("firebase-token")?.value;

    if (!token) {
      return NextResponse.json({ user: null }, { status: 401 });
    }

    const { adminAuth } = await import("@/lib/firebase-admin");
    const decoded = await adminAuth.verifyIdToken(token);
    const supabase = createAdminClient();

    const { data: user } = await supabase
      .from("users")
      .select("*")
      .eq("firebase_uid", decoded.uid)
      .single();

    if (!user) {
      const response = NextResponse.json({ user: null }, { status: 401 });
      response.cookies.set("firebase-token", "", { maxAge: 0, path: "/" });
      response.cookies.set("user-role", "", { maxAge: 0, path: "/" });
      return response;
    }

    const response = NextResponse.json({ user });

    const cookieRole = request.cookies.get("user-role")?.value;
    if (cookieRole !== user.role) {
      response.cookies.set("user-role", user.role, {
        httpOnly: false,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60,
        path: "/",
      });
    }

    return response;
  } catch {
    return NextResponse.json({ user: null }, { status: 401 });
  }
}
