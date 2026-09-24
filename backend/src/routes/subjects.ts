import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { subjectSchema } from '../lib/schemas.js';

function isDuplicateName(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
}
export const subjectsRouter = Router();

subjectsRouter.get('/', async (request, response, next) => {
  try {
    const includeArchived = request.query.archived === 'true';
    const subjects = await prisma.subject.findMany({
      where: { userId: request.userId!, ...(includeArchived ? {} : { archivedAt: null }) },
      orderBy: [{ archivedAt: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { tasks: true } } },
    });
    response.json({ subjects });
  } catch (error) {
    next(error);
  }
});

subjectsRouter.post('/', async (request, response, next) => {
  try {
    const parsed = subjectSchema.safeParse(request.body);
    if (!parsed.success) return response.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid subject.' });
    const subject = await prisma.subject.create({
      data: { ...parsed.data, userId: request.userId! },
      include: { _count: { select: { tasks: true } } },
    });
    response.status(201).json({ subject });
  } catch (error) {
    if (isDuplicateName(error)) return response.status(409).json({ error: 'A subject with this name already exists.' });
    next(error);
  }
});

subjectsRouter.patch('/:id', async (request, response, next) => {
  try {
    const id = Number(request.params.id);
    const existing = await prisma.subject.findFirst({ where: { id, userId: request.userId! } });
    if (!existing) return response.status(404).json({ error: 'Subject not found.' });
    const parsed = subjectSchema.partial().extend({ archived: z.boolean().optional() }).safeParse(request.body);
    if (!parsed.success) return response.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid subject.' });
    const { archived: _ignored, ...data } = parsed.data;
    const archivedAt = typeof request.body.archived === 'boolean'
      ? (request.body.archived ? new Date() : null)
      : existing.archivedAt;
    const subject = await prisma.subject.update({
      where: { id }, data: { ...data, archivedAt },
      include: { _count: { select: { tasks: true } } },
    });
    response.json({ subject });
  } catch (error) {
    if (isDuplicateName(error)) return response.status(409).json({ error: 'A subject with this name already exists.' });
    next(error);
  }
});

subjectsRouter.delete('/:id', async (request, response, next) => {
  try {
    const id = Number(request.params.id);
    const existing = await prisma.subject.findFirst({ where: { id, userId: request.userId! }, include: { _count: { select: { tasks: true } } } });
    if (!existing) return response.status(404).json({ error: 'Subject not found.' });
    if (existing._count.tasks > 0) return response.status(409).json({ error: 'Archive this subject instead; it still has task history.' });
    await prisma.subject.delete({ where: { id } });
    response.status(204).end();
  } catch (error) {
    next(error);
  }
});
