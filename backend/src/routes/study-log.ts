import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';

export const studyLogRouter = Router();

const dateSchema = z.string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a date in YYYY-MM-DD format.')
  .refine((value) => {
    const [year, month, day] = value.split('-').map(Number);
    if (![year, month, day].every(Number.isFinite)) return false;
    const parsed = new Date(Date.UTC(year, month - 1, day));
    return parsed.toISOString().slice(0, 10) === value;
  }, 'Choose a valid calendar date.');
const daySchema = z.object({
  targetMinutes: z.number().int().min(0).max(1440).optional(),
  actualMinutes: z.number().int().min(0).max(1440).optional(),
}).refine((value) => value.targetMinutes !== undefined || value.actualMinutes !== undefined, 'Provide a target or actual time.');

function addDays(dateKey: string, days: number) {
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

function elapsedSeconds(timer: { status: string; startedAt: Date | null; elapsedSeconds: number }, now = new Date()) {
  if (timer.status !== 'RUNNING' || !timer.startedAt) return timer.elapsedSeconds;
  return timer.elapsedSeconds + Math.max(0, Math.floor((now.getTime() - timer.startedAt.getTime()) / 1000));
}

studyLogRouter.get('/', async (request, response, next) => {
  try {
    const start = dateSchema.safeParse(request.query.start);
    const requestedEnd = request.query.end === undefined ? null : dateSchema.safeParse(request.query.end);
    if (!start.success) return response.status(400).json({ error: 'Choose a valid start date.' });
    if (requestedEnd && !requestedEnd.success) return response.status(400).json({ error: 'Choose a valid end date.' });
    const end = requestedEnd?.data ?? addDays(start.data, 6);
    const rangeDays = Math.round((Date.parse(end) - Date.parse(start.data)) / 86_400_000);
    if (rangeDays < 0 || rangeDays > 366) return response.status(400).json({ error: 'Choose a date range of no more than one year.' });
    const [logs, timer] = await Promise.all([
      prisma.studyLog.findMany({
        where: { userId: request.userId!, date: { gte: start.data, lte: end } },
        orderBy: { date: 'asc' },
      }),
      prisma.studyTimer.findUnique({ where: { userId: request.userId! } }),
    ]);
    response.json({ logs, timer });
  } catch (error) {
    next(error);
  }
});

studyLogRouter.patch('/days/:date', async (request, response, next) => {
  try {
    const date = dateSchema.safeParse(String(request.params.date));
    const data = daySchema.safeParse(request.body);
    if (!date.success) return response.status(400).json({ error: date.error.issues[0]?.message ?? 'Invalid date.' });
    if (!data.success) return response.status(400).json({ error: data.error.issues[0]?.message ?? 'Invalid study time.' });
    const log = await prisma.studyLog.upsert({
      where: { userId_date: { userId: request.userId!, date: date.data } },
      create: { userId: request.userId!, date: date.data, ...data.data },
      update: data.data,
    });
    response.json({ log });
  } catch (error) {
    next(error);
  }
});

studyLogRouter.post('/timer/start', async (request, response, next) => {
  try {
    const date = dateSchema.safeParse(request.body?.date);
    if (!date.success) return response.status(400).json({ error: 'Choose a valid date.' });
    const existing = await prisma.studyTimer.findUnique({ where: { userId: request.userId! } });
    if (existing) return response.status(409).json({ error: 'A study session is already active.' });
    const timer = await prisma.studyTimer.create({
      data: { userId: request.userId!, logDate: date.data, status: 'RUNNING', startedAt: new Date() },
    });
    response.status(201).json({ timer });
  } catch (error) {
    next(error);
  }
});

studyLogRouter.post('/timer/pause', async (request, response, next) => {
  try {
    const timer = await prisma.studyTimer.findUnique({ where: { userId: request.userId! } });
    if (!timer) return response.status(404).json({ error: 'No active study session.' });
    if (timer.status === 'PAUSED') return response.json({ timer });
    const now = new Date();
    const updated = await prisma.studyTimer.update({
      where: { id: timer.id },
      data: { status: 'PAUSED', startedAt: null, elapsedSeconds: elapsedSeconds(timer, now) },
    });
    response.json({ timer: updated });
  } catch (error) {
    next(error);
  }
});

studyLogRouter.post('/timer/resume', async (request, response, next) => {
  try {
    const timer = await prisma.studyTimer.findUnique({ where: { userId: request.userId! } });
    if (!timer) return response.status(404).json({ error: 'No active study session.' });
    if (timer.status === 'RUNNING') return response.json({ timer });
    const updated = await prisma.studyTimer.update({
      where: { id: timer.id },
      data: { status: 'RUNNING', startedAt: new Date() },
    });
    response.json({ timer: updated });
  } catch (error) {
    next(error);
  }
});

studyLogRouter.post('/timer/end', async (request, response, next) => {
  try {
    const result = await prisma.$transaction(async (database) => {
      const timer = await database.studyTimer.findUnique({ where: { userId: request.userId! } });
      if (!timer) return null;
      const seconds = elapsedSeconds(timer);
      const minutes = seconds > 0 ? Math.max(1, Math.round(seconds / 60)) : 0;
      const log = await database.studyLog.upsert({
        where: { userId_date: { userId: request.userId!, date: timer.logDate } },
        create: { userId: request.userId!, date: timer.logDate, actualMinutes: minutes },
        update: { actualMinutes: { increment: minutes } },
      });
      await database.studyTimer.delete({ where: { id: timer.id } });
      return { log, durationSeconds: seconds, loggedMinutes: minutes };
    });
    if (!result) return response.status(404).json({ error: 'No active study session.' });
    response.json(result);
  } catch (error) {
    next(error);
  }
});
