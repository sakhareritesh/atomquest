import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import { syncQuarterlyWindows } from "@/lib/utils/sync-windows";

export async function POST(request: NextRequest) {
  const { error: authError } = await requireRole(request, ["admin"]);
  if (authError) return authError;

  const result = await syncQuarterlyWindows();

  return NextResponse.json({
    message:
      result.opened + result.closed > 0
        ? `Synced: ${result.opened} opened, ${result.closed} closed`
        : "All windows are already in sync with their dates",
    ...result,
  });
}
