import { Router } from 'express';
import { prisma } from '../db.js';
import { nextRecurringDate, parseDateOnly } from '../lib/dates.js';
import { taskEntrySchema, taskPatchSchema, taskSchema } from '../lib/schemas.js';

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
    const { carryNote, ...patch } = parsed.data;
    const dates = taskDates(patch);
    const moved = parsed.data.scheduledDate !== undefined
      && (parseDateOnly(parsed.data.scheduledDate)?.getTime() ?? null) !== (existing.scheduledDate?.getTime() ?? null);
    const completing = parsed.data.status === 'COMPLETED' && existing.status !== 'COMPLETED';
    const reopening = parsed.data.status && parsed.data.status !== 'COMPLETED' && existing.status === 'COMPLETED';

    const task = await prisma.$transaction(async (database) => {
      const updated = await database.task.update({
        where: { id },
        data: {
          ...dates,
          // Save the reflection and the new planned day together.
          ...(carryNote ? { entries: { create: { content: carryNote } } } : {}),
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

tasksRouter.get('/:id/entries', async (request, response, next) => {
  try {
    const taskId = Number(request.params.id);
    if (!await prisma.task.findFirst({ where: { id: taskId, userId: request.userId! } })) {
      return response.status(404).json({ error: 'Task not found.' });
    }
    const entries = await prisma.taskEntry.findMany({ where: { taskId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] });
    response.json({ entries });
  } catch (error) { next(error); }
});

tasksRouter.post('/:id/entries', async (request, response, next) => {
  try {
    const taskId = Number(request.params.id);
    if (!await prisma.task.findFirst({ where: { id: taskId, userId: request.userId! } })) {
      return response.status(404).json({ error: 'Task not found.' });
    }
    const parsed = taskEntrySchema.safeParse(request.body);
    if (!parsed.success) return response.status(400).json({ error: 'Enter a note between 1 and 2000 characters.' });
    const entry = await prisma.taskEntry.create({ data: { taskId, content: parsed.data.content } });
    response.status(201).json({ entry });
  } catch (error) { next(error); }
});

tasksRouter.patch('/:id/entries/:entryId', async (request, response, next) => {
  try {
    const id = Number(request.params.entryId);
    const entry = await prisma.taskEntry.findFirst({ where: { id, taskId: Number(request.params.id), task: { userId: request.userId! } } });
    if (!entry) return response.status(404).json({ error: 'Note not found.' });
    const parsed = taskEntrySchema.safeParse(request.body);
    if (!parsed.success) return response.status(400).json({ error: 'Enter a note between 1 and 2000 characters.' });
    response.json({ entry: await prisma.taskEntry.update({ where: { id }, data: parsed.data }) });
  } catch (error) { next(error); }
});

tasksRouter.delete('/:id/entries/:entryId', async (request, response, next) => {
  try {
    const id = Number(request.params.entryId);
    const entry = await prisma.taskEntry.findFirst({ where: { id, taskId: Number(request.params.id), task: { userId: request.userId! } } });
    if (!entry) return response.status(404).json({ error: 'Note not found.' });
    await prisma.taskEntry.delete({ where: { id } });
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
