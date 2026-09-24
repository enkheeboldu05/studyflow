import { Router } from 'express';
import { prisma } from '../db.js';
import { nextRecurringDate, parseDateOnly } from '../lib/dates.js';
import { taskPatchSchema, taskSchema } from '../lib/schemas.js';

export const tasksRouter = Router();

async function ensureOwnedSubject(userId: number, subjectId?: number | null) {
  if (!subjectId) return true;
  return Boolean(await prisma.subject.findFirst({ where: { id: subjectId, userId, archivedAt: null } }));
}

function taskDates<T extends { scheduledDate?: string | null; dueDate?: string | null }>(data: T) {
  return {
    ...data,
    ...(data.scheduledDate !== undefined ? { scheduledDate: parseDateOnly(data.scheduledDate) } : {}),
    ...(data.dueDate !== undefined ? { dueDate: parseDateOnly(data.dueDate) } : {}),
  };
}

tasksRouter.get('/', async (request, response, next) => {
  try {
    const from = typeof request.query.from === 'string' ? parseDateOnly(request.query.from) : null;
    const to = typeof request.query.to === 'string' ? parseDateOnly(request.query.to) : null;
    const where: Record<string, unknown> = { userId: request.userId!, archivedAt: request.query.archived === 'true' ? { not: null } : null };
    if (request.query.bucket === 'inbox') where.scheduledDate = null;
    if (from || to) where.scheduledDate = { ...(from ? { gte: from } : {}), ...(to ? { lt: to } : {}) };
    if (request.query.status) where.status = request.query.status;
    if (request.query.priority) where.priority = request.query.priority;
    if (request.query.subjectId) where.subjectId = Number(request.query.subjectId);
    if (request.query.search) where.OR = [
      { title: { contains: String(request.query.search) } },
      { description: { contains: String(request.query.search) } },
    ];
    const tasks = await prisma.task.findMany({
      where,
      include: { subject: true },
      orderBy: [{ scheduledDate: 'asc' }, { important: 'desc' }, { position: 'asc' }, { createdAt: 'desc' }],
    });
    response.json({ tasks });
  } catch (error) {
    next(error);
  }
});

tasksRouter.post('/', async (request, response, next) => {
  try {
    const parsed = taskSchema.safeParse(request.body);
    if (!parsed.success) return response.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid task.' });
    if (!(await ensureOwnedSubject(request.userId!, parsed.data.subjectId))) {
      return response.status(400).json({ error: 'Choose one of your active subjects.' });
    }
    const data = taskDates(parsed.data);
    const task = await prisma.task.create({
      data: { ...data, userId: request.userId!, completedAt: data.status === 'COMPLETED' ? new Date() : null },
      include: { subject: true },
    });
    response.status(201).json({ task });
  } catch (error) {
    next(error);
  }
});

tasksRouter.patch('/:id', async (request, response, next) => {
  try {
    const id = Number(request.params.id);
    const existing = await prisma.task.findFirst({ where: { id, userId: request.userId! } });
    if (!existing) return response.status(404).json({ error: 'Task not found.' });
    const parsed = taskPatchSchema.safeParse(request.body);
    if (!parsed.success) return response.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid task.' });
    if (!(await ensureOwnedSubject(request.userId!, parsed.data.subjectId))) {
      return response.status(400).json({ error: 'Choose one of your active subjects.' });
    }
    const dates = taskDates(parsed.data);
    const moved = parsed.data.scheduledDate !== undefined
      && (parseDateOnly(parsed.data.scheduledDate)?.getTime() ?? null) !== (existing.scheduledDate?.getTime() ?? null);
    const completing = parsed.data.status === 'COMPLETED' && existing.status !== 'COMPLETED';
    const reopening = parsed.data.status && parsed.data.status !== 'COMPLETED' && existing.status === 'COMPLETED';

    const task = await prisma.$transaction(async (database) => {
      const updated = await database.task.update({
        where: { id },
        data: {
          ...dates,
          ...(moved ? { rescheduleCount: { increment: 1 } } : {}),
          ...(completing ? { completedAt: new Date() } : {}),
          ...(reopening ? { completedAt: null } : {}),
        },
        include: { subject: true },
      });

      if (completing && existing.recurrence !== 'NONE') {
        const base = existing.scheduledDate ?? new Date();
        const nextDate = nextRecurringDate(base, existing.recurrence);
        await database.task.create({
          data: {
            userId: existing.userId,
            subjectId: existing.subjectId,
            title: existing.title,
            description: existing.description,
            priority: existing.priority,
            scheduledDate: nextDate,
            dueDate: existing.dueDate ? nextRecurringDate(existing.dueDate, existing.recurrence) : null,
            estimatedMinutes: existing.estimatedMinutes,
            important: existing.important,
            recurrence: existing.recurrence,
            recurrenceSourceId: existing.recurrenceSourceId ?? existing.id,
          },
        });
      }
      return updated;
    });
    response.json({ task });
  } catch (error) {
    next(error);
  }
});

tasksRouter.get('/:id/notes', async (request, response, next) => {
  try {
    const task = await prisma.task.findFirst({ where: { id: Number(request.params.id), userId: request.userId! } });
    if (!task) return response.status(404).json({ error: 'Task not found.' });
    const links = await prisma.taskNote.findMany({ where: { taskId: task.id }, include: { note: { include: { vault: { select: { name: true } } } } }, orderBy: { note: { title: 'asc' } } });
    response.json({ notes: links.map((link) => link.note) });
  } catch (error) { next(error); }
});

tasksRouter.post('/:id/notes', async (request, response, next) => {
  try {
    const taskId = Number(request.params.id);
    const noteId = Number(request.body?.noteId);
    const [task, note] = await Promise.all([
      prisma.task.findFirst({ where: { id: taskId, userId: request.userId! } }),
      prisma.vaultNote.findFirst({ where: { id: noteId, vault: { userId: request.userId! }, available: true } }),
    ]);
    if (!task || !note) return response.status(404).json({ error: 'Task or note not found.' });
    const link = await prisma.taskNote.upsert({ where: { taskId_noteId: { taskId, noteId } }, create: { taskId, noteId }, update: {} });
    response.status(201).json({ link });
  } catch (error) { next(error); }
});

tasksRouter.delete('/:id/notes/:noteId', async (request, response, next) => {
  try {
    const taskId = Number(request.params.id);
    const noteId = Number(request.params.noteId);
    const task = await prisma.task.findFirst({ where: { id: taskId, userId: request.userId! } });
    if (!task) return response.status(404).json({ error: 'Task not found.' });
    await prisma.taskNote.deleteMany({ where: { taskId, noteId, note: { vault: { userId: request.userId! } } } });
    response.status(204).end();
  } catch (error) { next(error); }
});

tasksRouter.delete('/:id', async (request, response, next) => {
  try {
    const id = Number(request.params.id);
    const existing = await prisma.task.findFirst({ where: { id, userId: request.userId! } });
    if (!existing) return response.status(404).json({ error: 'Task not found.' });
    await prisma.task.delete({ where: { id } });
    response.status(204).end();
  } catch (error) {
    next(error);
  }
});
