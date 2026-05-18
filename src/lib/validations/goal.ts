import { z } from "zod";

export const goalSchema = z
  .object({
    thrust_area_id: z.string().min(1, "Thrust area is required"),
    title: z.string().min(3, "Title must be at least 3 characters").max(200),
    description: z.string().max(1000).optional().default(""),
    uom_type: z.enum(["min_numeric", "max_numeric", "timeline", "zero"], {
      message: "Unit of Measurement is required",
    }),
    target_value: z.coerce.number().nullable().optional(),
    target_date: z.string().nullable().optional(),
    weightage: z.coerce
      .number()
      .min(10, "Minimum weightage is 10%")
      .max(100, "Maximum weightage is 100%"),
  })
  .superRefine((data, ctx) => {
    if (
      data.uom_type === "min_numeric" ||
      data.uom_type === "max_numeric" ||
      data.uom_type === "zero"
    ) {
      if (data.target_value == null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Target value is required for this UoM type",
          path: ["target_value"],
        });
      }
    }
    if (data.uom_type === "timeline") {
      if (!data.target_date) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Target date is required for Timeline UoM",
          path: ["target_date"],
        });
      }
    }
  });

export type GoalFormValues = z.infer<typeof goalSchema>;

export const sharedGoalUpdateSchema = z.object({
  id: z.string().min(1),
  weightage: z.coerce
    .number()
    .min(10, "Minimum weightage is 10%")
    .max(100, "Maximum weightage is 100%"),
});

export const sharedGoalCreateSchema = z
  .object({
    thrust_area_id: z.string().min(1, "Thrust area is required"),
    title: z.string().min(3, "Title must be at least 3 characters").max(200),
    description: z.string().max(1000).optional().default(""),
    uom_type: z.enum(["min_numeric", "max_numeric", "timeline", "zero"], {
      message: "Unit of Measurement is required",
    }),
    target_value: z.coerce.number().nullable().optional(),
    target_date: z.string().nullable().optional(),
    cycle_id: z.string().min(1, "Cycle is required"),
    employee_ids: z.array(z.string().min(1)).min(1, "Select at least one employee"),
  })
  .superRefine((data, ctx) => {
    if (
      data.uom_type === "min_numeric" ||
      data.uom_type === "max_numeric" ||
      data.uom_type === "zero"
    ) {
      if (data.target_value == null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Target value is required for this UoM type",
          path: ["target_value"],
        });
      }
    }
    if (data.uom_type === "timeline") {
      if (!data.target_date) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Target date is required for Timeline UoM",
          path: ["target_date"],
        });
      }
    }
  });

export function validateGoalSheet(goals: { weightage: number }[]) {
  const errors: string[] = [];

  if (goals.length === 0) {
    errors.push("At least one goal is required");
  }

  if (goals.length > 8) {
    errors.push("Maximum 8 goals allowed per employee");
  }

  const totalWeightage = goals.reduce((sum, g) => sum + g.weightage, 0);
  if (totalWeightage !== 100) {
    errors.push(`Total weightage must equal 100% (currently ${totalWeightage}%)`);
  }

  goals.forEach((g, i) => {
    if (g.weightage < 10) {
      errors.push(`Goal ${i + 1}: Minimum weightage is 10%`);
    }
  });

  return errors;
}

export const achievementSchema = z.object({
  actual_achievement: z.coerce.number().min(0, "Achievement cannot be negative"),
  progress_status: z.enum(["not_started", "on_track", "completed"]),
});

export const checkinSchema = z.object({
  comment: z.string().min(10, "Comment must be at least 10 characters").max(2000),
});

export const cycleSchema = z.object({
  name: z.string().min(3, "Cycle name is required"),
  year: z.coerce.number().min(2020).max(2030),
  goal_setting_start: z.string().min(1, "Start date is required"),
  goal_setting_end: z.string().min(1, "End date is required"),
});

export const thrustAreaSchema = z.object({
  name: z.string().min(2, "Name is required"),
  description: z.string().min(5, "Description is required"),
  department: z.string().min(1, "Department is required"),
});

export const userSchema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.string().email("Invalid email"),
  role: z.enum(["employee", "manager", "admin"]),
  department: z.string().min(1, "Department is required"),
  designation: z.string().min(1, "Designation is required"),
  manager_id: z.string().nullable(),
});
