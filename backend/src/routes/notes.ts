import { Router } from 'express';
import { prisma } from '../db.js';
import { readNoteFile } from '../vault/indexer.js';

export const notesRouter = Router();

notesRouter.get('/meta', async (request, response, next) => {
  try {
    const connection = await prisma.vaultConnection.findUnique({ where: { userId: request.userId! } });
    if (!connection) return response.json({ folders: [], tags: [], properties: [] });
    const [folderRows, tags, propertyRows] = await Promise.all([
      prisma.vaultNote.findMany({ where: { vaultId: connection.id, available: true }, select: { folder: true } }),
      prisma.vaultTag.findMany({ where: { vaultId: connection.id }, include: { _count: { select: { notes: true } } }, orderBy: { displayName: 'asc' } }),
      prisma.vaultProperty.findMany({ where: { note: { vaultId: connection.id, available: true } }, select: { name: true, normalizedName: true } }),
    ]);
    const folders = [...new Set(folderRows.map((item) => item.folder).filter(Boolean))].sort();
    const properties = [...new Map(propertyRows.map((item) => [item.normalizedName, item.name])).entries()].map(([normalizedName, name]) => ({ normalizedName, name }));
    response.json({ folders, tags, properties });
  } catch (error) { next(error); }
});

notesRouter.get('/', async (request, response, next) => {
  try {
    const connection = await prisma.vaultConnection.findUnique({ where: { userId: request.userId! } });
    if (!connection) return response.json({ notes: [] });
    const search = typeof request.query.search === 'string' ? request.query.search.trim() : '';
    const folder = typeof request.query.folder === 'string' ? request.query.folder : '';
    const tags = typeof request.query.tags === 'string' ? request.query.tags.split(',').filter(Boolean) : [];
    const property = typeof request.query.property === 'string' ? request.query.property : '';
    const subjectId = typeof request.query.subjectId === 'string' ? Number(request.query.subjectId) : 0;
    const sort = request.query.sort === 'modified' ? 'modified' : 'title';
    const notes = await prisma.vaultNote.findMany({
      where: {
        vaultId: connection.id, available: true,
        ...(search ? { OR: [{ title: { contains: search } }, { relativePath: { contains: search } }, { properties: { some: { value: { contains: search } } } }] } : {}),
        ...(folder ? { folder: { startsWith: folder } } : {}),
        ...(property ? { properties: { some: { normalizedName: property.toLocaleLowerCase() } } } : {}),
        ...(subjectId ? { taskLinks: { some: { task: { subjectId, userId: request.userId! } } } } : {}),
        ...(tags.length ? { AND: tags.map((tag) => ({ tags: { some: { tag: { normalizedName: tag.toLocaleLowerCase() } } } })) } : {}),
      },
      include: { tags: { include: { tag: true } }, _count: { select: { outgoingLinks: true, incomingLinks: true, taskLinks: true } } },
      orderBy: sort === 'modified' ? [{ modifiedAt: 'desc' }, { title: 'asc' }] : [{ title: 'asc' }],
      take: 1000,
    });
    response.json({ notes });
  } catch (error) { next(error); }
});

notesRouter.get('/:id', async (request, response, next) => {
  try {
    const note = await prisma.vaultNote.findFirst({
      where: { id: Number(request.params.id), vault: { userId: request.userId! } },
      include: {
        vault: { select: { name: true } },
        tags: { include: { tag: true } }, properties: { orderBy: { name: 'asc' } },
        outgoingLinks: { include: { targetNote: { select: { id: true, title: true, relativePath: true, available: true } }, targetAttachment: { select: { id: true, relativePath: true, mimeType: true, available: true } } } },
        incomingLinks: { include: { sourceNote: { select: { id: true, title: true, relativePath: true, available: true } } } },
        taskLinks: { include: { task: { select: { id: true, title: true, status: true, scheduledDate: true } } } },
      },
    });
    if (!note) return response.status(404).json({ error: 'Note not found.' });
    response.json({ note });
  } catch (error) { next(error); }
});

notesRouter.get('/:id/content', async (request, response, next) => {
  try {
    const { note, parsed } = await readNoteFile(request.userId!, Number(request.params.id));
    const links = await prisma.vaultLink.findMany({ where: { sourceNoteId: note.id, targetAttachmentId: { not: null } }, select: { rawTarget: true, targetAttachmentId: true } });
    response.json({ content: parsed.body, attachments: links.map((link) => ({ rawTarget: link.rawTarget, url: '/api/vault/attachments/' + link.targetAttachmentId })) });
  } catch (error) { next(error); }
});
