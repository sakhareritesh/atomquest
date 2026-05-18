import type { UomType } from "@/types";

const MAX_SCORE_CAP = 150;

export function computeScore(
  uomType: UomType,
  target: number | null,
  actual: number | null,
  targetDate?: string | null,
  completionDate?: string | null
): number {
  let raw: number;

  switch (uomType) {
    case "min_numeric": {
      if (!target || target === 0) return 0;
      if (actual == null) return 0;
      raw = Math.round((actual / target) * 100 * 100) / 100;
      return Math.min(raw, MAX_SCORE_CAP);
    }
    case "max_numeric": {
      if (!target || target === 0) return 0;
      if (actual == null) return 0;
      if (actual === 0) return 100;
      raw = Math.round((target / actual) * 100 * 100) / 100;
      return Math.min(raw, MAX_SCORE_CAP);
    }
    case "timeline": {
      if (!targetDate) return 0;
      if (!completionDate) return 0;
      const deadline = new Date(targetDate);
      const completed = new Date(completionDate);
      return completed <= deadline ? 100 : 0;
    }
    case "zero": {
      if (actual == null) return 0;
      return actual === 0 ? 100 : 0;
    }
    default:
      return 0;
  }
}

export function computeOverallScore(
  goals: Array<{ weightage: number; id: string }>,
  achievements: Array<{ goal_id: string; computed_score: number | null }>
): number {
  const achMap = new Map(
    achievements.map((a) => [a.goal_id, a.computed_score ?? 0])
  );

  let weightedSum = 0;
  let totalWeightage = 0;

  for (const goal of goals) {
    const score = achMap.get(goal.id);
    if (score != null) {
      weightedSum += score * goal.weightage;
      totalWeightage += goal.weightage;
    }
  }

  if (totalWeightage === 0) return 0;
  return Math.round((weightedSum / totalWeightage) * 100) / 100;
}

export function computeQuarterlyOverallScores(
  goals: Array<{ weightage: number; id: string }>,
  achievements: Array<{ goal_id: string; quarter: string; computed_score: number | null }>
): Record<string, number> {
  const quarters = ["Q1", "Q2", "Q3", "Q4"];
  const result: Record<string, number> = {};

  for (const q of quarters) {
    const qAchievements = achievements.filter((a) => a.quarter === q);
    result[q] = computeOverallScore(goals, qAchievements);
  }

  return result;
}

export function getScoreColor(score: number): string {
  if (score >= 90) return "text-green-600";
  if (score >= 70) return "text-yellow-600";
  if (score >= 50) return "text-orange-600";
  return "text-red-600";
}

export function getStatusColor(status: string): string {
  switch (status) {
    case "completed":
      return "bg-green-100 text-green-800";
    case "on_track":
      return "bg-blue-100 text-blue-800";
    case "not_started":
      return "bg-gray-100 text-gray-800";
    case "approved":
    case "locked":
      return "bg-green-100 text-green-800";
    case "submitted":
      return "bg-yellow-100 text-yellow-800";
    case "rejected":
      return "bg-red-100 text-red-800";
    case "draft":
      return "bg-gray-100 text-gray-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

export function getUomLabel(uom: UomType): string {
  switch (uom) {
    case "min_numeric":
      return "Numeric (Higher is Better)";
    case "max_numeric":
      return "Numeric (Lower is Better)";
    case "timeline":
      return "Timeline";
    case "zero":
      return "Zero-Based";
  }
}
