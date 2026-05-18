import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const results: Record<string, string> = {};

  // Check env vars
  results.firebase_project = process.env.FIREBASE_PROJECT_ID ? "set" : "MISSING";
  results.firebase_email = process.env.FIREBASE_CLIENT_EMAIL ? "set" : "MISSING";
  results.firebase_key = process.env.FIREBASE_PRIVATE_KEY ? "set" : "MISSING";
  results.supabase_url = process.env.NEXT_PUBLIC_SUPABASE_URL || "MISSING";
  results.supabase_key = process.env.SUPABASE_SERVICE_ROLE_KEY ? "set" : "MISSING";

  // Check Supabase connection and tables
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase.from("users").select("id").limit(1);
    if (error) {
      results.supabase_users_table = `ERROR: ${error.message}`;
    } else {
      results.supabase_users_table = `OK (${data.length} rows found)`;
    }
  } catch (err: unknown) {
    results.supabase_connection = `FAILED: ${err instanceof Error ? err.message : String(err)}`;
  }

  // Check Firebase Admin
  try {
    const { adminAuth } = await import("@/lib/firebase-admin");
    const testResult = typeof adminAuth.verifyIdToken;
    results.firebase_admin = testResult === "function" ? "OK" : "ERROR: not a function";
  } catch (err: unknown) {
    results.firebase_admin = `FAILED: ${err instanceof Error ? err.message : String(err)}`;
  }

  return NextResponse.json(results, { status: 200 });
}
