import { z } from 'zod';

const optionalDate = z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal(''), z.null()]).optional();

export const signupSchema = z.object({
  username: z.string().trim().min(2).max(40),
  email: z.string().trim().email().max(120).transform((value) => value.toLowerCase()),
  password: z.string().min(8).max(100),
});

export const loginSchema = z.object({
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
  password: z.string().min(1),
});

export const subjectSchema = z.object({
  name: z.string().trim().min(1).max(60),
  description: z.string().trim().max(300).optional().nullable(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});

export const taskSchema = z.object({
  title: z.string().trim().min(1).max(180),
  description: z.string().trim().max(2000).optional().nullable(),
  subjectId: z.number().int().positive().optional().nullable(),
  status: z.enum(['TODO', 'IN_PROGRESS', 'COMPLETED']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
  scheduledDate: optionalDate,
  dueDate: optionalDate,
  estimatedMinutes: z.number().int().min(5).max(1440).optional().nullable(),
  important: z.boolean().optional(),
  recurrence: z.enum(['NONE', 'DAILY', 'WEEKDAYS', 'WEEKLY', 'MONTHLY']).optional(),
  position: z.number().finite().optional(),
});

export const taskPatchSchema = taskSchema.partial().extend({
  archivedAt: z.union([z.string().datetime(), z.null()]).optional(),
});

export const settingsSchema = z.object({
  theme: z.enum(['LIGHT', 'DARK', 'SYSTEM']).optional(),
  weekStartsOn: z.union([z.literal(0), z.literal(1)]).optional(),
  defaultPage: z.enum(['today', 'week', 'inbox', 'notes', 'progress', 'settings']).optional(),
  showCompleted: z.boolean().optional(),
  morningCheckIn: z.boolean().optional(),
  automaticBackup: z.boolean().optional(),
});
