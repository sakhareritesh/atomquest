import { format, isWithinInterval, parseISO } from "date-fns";
import type { Quarter, QuarterlyWindow } from "@/types";

export function isWindowOpen(window: QuarterlyWindow): boolean {
  if (window.status === "closed") return false;
  const now = new Date();
  return isWithinInterval(now, {
    start: parseISO(window.window_open),
    end: parseISO(window.window_close),
  });
}

export function isWindowOpenByFields(
  windowOpen: string,
  windowClose: string,
  status: string
): boolean {
  if (status === "closed") return false;
  const now = new Date();
  return isWithinInterval(now, {
    start: parseISO(windowOpen),
    end: parseISO(windowClose),
  });
}

export function getCurrentQuarter(): Quarter {
  const month = new Date().getMonth() + 1;
  if (month >= 4 && month <= 6) return "Q1";
  if (month >= 7 && month <= 9) return "Q2";
  if (month >= 10 && month <= 12) return "Q3";
  return "Q4";
}

export function formatDate(date: string | Date): string {
  return format(typeof date === "string" ? parseISO(date) : date, "dd MMM yyyy");
}

export function formatDateTime(date: string | Date): string {
  return format(
    typeof date === "string" ? parseISO(date) : date,
    "dd MMM yyyy, hh:mm a"
  );
}

export function getQuarterLabel(quarter: Quarter): string {
  switch (quarter) {
    case "Q1":
      return "Q1 (Apr - Jun)";
    case "Q2":
      return "Q2 (Jul - Sep)";
    case "Q3":
      return "Q3 (Oct - Dec)";
    case "Q4":
      return "Q4 (Jan - Mar)";
  }
}
