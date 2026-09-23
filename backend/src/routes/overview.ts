import { Router } from 'express';
import { prisma } from '../db.js';
import { endOfLocalDay, parseDateOnly, startOfLocalDay, toDateKey } from '../lib/dates.js';
import { settingsSchema } from '../lib/schemas.js';

export const overviewRouter = Router();

overviewRouter.get('/dashboard', async (request, response, next) => {
  try {
    const today = startOfLocalDay();
    const tomorrow = endOfLocalDay();
    const inSevenDays = new Date(today); inSevenDays.setDate(inSevenDays.getDate() + 8);
    const base = { userId: request.userId!, archivedAt: null };
    const [todayTasks, overdue, upcoming, recent, completedTotal, total] = await Promise.all([
      prisma.task.findMany({ where: { ...base, scheduledDate: { gte: today, lt: tomorrow } }, include: { subject: true }, orderBy: [{ position: 'asc' }, { important: 'desc' }] }),
      prisma.task.findMany({ where: { ...base, status: { not: 'COMPLETED' }, scheduledDate: { lt: today } }, include: { subject: true }, orderBy: { scheduledDate: 'asc' } }),
      prisma.task.findMany({ where: { ...base, status: { not: 'COMPLETED' }, scheduledDate: { gte: tomorrow, lt: inSevenDays } }, include: { subject: true }, orderBy: { scheduledDate: 'asc' }, take: 8 }),
      prisma.task.findMany({ where: { ...base, status: 'COMPLETED' }, include: { subject: true }, orderBy: { completedAt: 'desc' }, take: 6 }),
      prisma.task.count({ where: { ...base, status: 'COMPLETED' } }),
      prisma.task.count({ where: base }),
    ]);
    response.json({ today: todayTasks, overdue, upcoming, recent, stats: { completed: completedTotal, total } });
  } catch (error) { next(error); }
});

overviewRouter.get('/check-in', async (request, response, next) => {
  try {
    const settings = await prisma.userSettings.findUnique({ where: { userId: request.userId! } });
    const today = startOfLocalDay();
    const needed = Boolean(settings?.morningCheckIn && (!settings.lastCheckInAt || settings.lastCheckInAt < today));
    const carryOver = needed ? await prisma.task.findMany({
      where: { userId: request.userId!, archivedAt: null, status: { not: 'COMPLETED' }, scheduledDate: { lt: today } },
      include: { subject: true },
      orderBy: { scheduledDate: 'asc' },
    }) : [];
    response.json({ needed, carryOver });
  } catch (error) { next(error); }
});

overviewRouter.post('/check-in/complete', async (request, response, next) => {
  try {
    await prisma.userSettings.upsert({
      where: { userId: request.userId! },
      create: { userId: request.userId!, lastCheckInAt: new Date() },
      update: { lastCheckInAt: new Date() },
    });
    response.status(204).end();
  } catch (error) { next(error); }
});

overviewRouter.get('/progress', async (request, response, next) => {
  try {
    const start = new Date(); start.setDate(start.getDate() - 364); start.setHours(0, 0, 0, 0);
    const completed = await prisma.task.findMany({
      where: { userId: request.userId!, completedAt: { gte: start } },
      select: { completedAt: true, estimatedMinutes: true, subject: { select: { name: true, color: true } } },
    });
    const days: Record<string, { count: number; minutes: number }> = {};
    const subjects: Record<string, { count: number; color: string }> = {};
    for (const task of completed) {
      if (!task.completedAt) continue;
      const key = toDateKey(task.completedAt);
      days[key] ??= { count: 0, minutes: 0 };
      days[key].count += 1;
      days[key].minutes += task.estimatedMinutes ?? 0;
      const name = task.subject?.name ?? 'Uncategorized';
      subjects[name] ??= { count: 0, color: task.subject?.color ?? '#8a8a84' };
      subjects[name].count += 1;
    }
    const weekStart = startOfLocalDay(); weekStart.setDate(weekStart.getDate() - 6);
    const thisWeek = completed.filter((task) => task.completedAt && task.completedAt >= weekStart);
    response.json({ days, subjects, summary: { total: completed.length, thisWeek: thisWeek.length, plannedMinutes: thisWeek.reduce((sum, task) => sum + (task.estimatedMinutes ?? 0), 0) } });
  } catch (error) { next(error); }
});

overviewRouter.get('/settings', async (request, response, next) => {
  try {
    const settings = await prisma.userSettings.findUnique({ where: { userId: request.userId! } });
    response.json({ settings });
  } catch (error) { next(error); }
});

overviewRouter.patch('/settings', async (request, response, next) => {
  try {
    const parsed = settingsSchema.safeParse(request.body);
    if (!parsed.success) return response.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid settings.' });
    const settings = await prisma.userSettings.upsert({
      where: { userId: request.userId! },
      create: { userId: request.userId!, ...parsed.data },
      update: parsed.data,
    });
    response.json({ settings });
  } catch (error) { next(error); }
});

overviewRouter.get('/backup', async (request, response, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: request.userId! },
      select: { username: true, email: true, createdAt: true, settings: true, subjects: true, tasks: true },
    });
    response.setHeader('Content-Disposition', `attachment; filename="studyflow-${toDateKey(new Date())}.json"`);
    response.json({ version: 1, exportedAt: new Date().toISOString(), data: user });
  } catch (error) { next(error); }
});

overviewRouter.post('/backup/restore', async (request, response, next) => {
  try {
    const backup = request.body?.data;
    if (!backup || !Array.isArray(backup.subjects) || !Array.isArray(backup.tasks)) {
      return response.status(400).json({ error: 'This is not a valid StudyFlow backup.' });
    }
    if (backup.subjects.length > 500 || backup.tasks.length > 20_000) {
      return response.status(400).json({ error: 'This backup is unexpectedly large.' });
    }

    await prisma.$transaction(async (database) => {
      await database.task.deleteMany({ where: { userId: request.userId! } });
      await database.subject.deleteMany({ where: { userId: request.userId! } });
      const subjectMap = new Map<number, number>();
      for (const source of backup.subjects) {
        if (typeof source.name !== 'string' || typeof source.color !== 'string') continue;
        const created = await database.subject.create({
          data: {
            userId: request.userId!,
            name: source.name.slice(0, 60),
            description: typeof source.description === 'string' ? source.description.slice(0, 300) : null,
            color: /^#[0-9a-fA-F]{6}$/.test(source.color) ? source.color : '#65725b',
            archivedAt: source.archivedAt ? new Date(source.archivedAt) : null,
          },
        });
        if (typeof source.id === 'number') subjectMap.set(source.id, created.id);
      }
      for (const source of backup.tasks) {
        if (typeof source.title !== 'string' || !source.title.trim()) continue;
        const statuses = ['TODO', 'IN_PROGRESS', 'COMPLETED'];
        const priorities = ['LOW', 'MEDIUM', 'HIGH'];
        const recurrences = ['NONE', 'DAILY', 'WEEKDAYS', 'WEEKLY', 'MONTHLY'];
        await database.task.create({
          data: {
            userId: request.userId!,
            subjectId: typeof source.subjectId === 'number' ? subjectMap.get(source.subjectId) ?? null : null,
            title: source.title.trim().slice(0, 180),
            description: typeof source.description === 'string' ? source.description.slice(0, 2000) : null,
            status: statuses.includes(source.status) ? source.status : 'TODO',
            priority: priorities.includes(source.priority) ? source.priority : 'MEDIUM',
            scheduledDate: source.scheduledDate ? new Date(source.scheduledDate) : null,
            dueDate: source.dueDate ? new Date(source.dueDate) : null,
            estimatedMinutes: Number.isInteger(source.estimatedMinutes) ? source.estimatedMinutes : null,
            important: Boolean(source.important),
            recurrence: recurrences.includes(source.recurrence) ? source.recurrence : 'NONE',
            position: typeof source.position === 'number' ? source.position : 0,
            rescheduleCount: Number.isInteger(source.rescheduleCount) ? source.rescheduleCount : 0,
            completedAt: source.completedAt ? new Date(source.completedAt) : null,
            archivedAt: source.archivedAt ? new Date(source.archivedAt) : null,
          },
        });
      }
      if (backup.settings) {
        const parsed = settingsSchema.safeParse(backup.settings);
        if (parsed.success) await database.userSettings.update({ where: { userId: request.userId! }, data: parsed.data });
      }
    });
    response.json({ restored: true });
  } catch (error) { next(error); }
});
