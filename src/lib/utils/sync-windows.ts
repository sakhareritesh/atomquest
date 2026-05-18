import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Auto-syncs quarterly window statuses based on their configured dates.
 * Opens windows when today is within [window_open, window_close].
 * Closes windows when today is outside that range.
 * Only processes windows belonging to active cycles.
 * Returns the count of windows that were changed.
 */
export async function syncQuarterlyWindows(): Promise<{
  opened: number;
  closed: number;
}> {
  const supabase = createAdminClient();

  const { data: activeCycles } = await supabase
    .from("cycles")
    .select("id")
    .eq("status", "active");

  if (!activeCycles || activeCycles.length === 0) {
    return { opened: 0, closed: 0 };
  }

  const cycleIds = activeCycles.map((c) => c.id);

  const { data: windows } = await supabase
    .from("quarterly_windows")
    .select("*")
    .in("cycle_id", cycleIds);

  if (!windows || windows.length === 0) {
    return { opened: 0, closed: 0 };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let opened = 0;
  let closed = 0;

  for (const win of windows) {
    const openDate = new Date(win.window_open);
    const closeDate = new Date(win.window_close);
    openDate.setHours(0, 0, 0, 0);
    closeDate.setHours(23, 59, 59, 999);

    const shouldBeOpen = today >= openDate && today <= closeDate;

    if (shouldBeOpen && win.status === "closed") {
      await supabase
        .from("quarterly_windows")
        .update({ status: "open" })
        .eq("id", win.id);
      opened++;
    } else if (!shouldBeOpen && win.status === "open") {
      await supabase
        .from("quarterly_windows")
        .update({ status: "closed" })
        .eq("id", win.id);
      closed++;
    }
  }

  return { opened, closed };
}
