import { Router } from 'express';
import { promises as fs } from 'node:fs';
import { prisma } from '../db.js';
import { connectVault, readAttachmentFile, refreshVault } from '../vault/indexer.js';
import { configuredVaultPath, validateVaultRoot } from '../vault/path-policy.js';

export const vaultRouter = Router();

vaultRouter.get('/status', async (request, response, next) => {
  try {
    const configured = Boolean(process.env.OBSIDIAN_VAULT_PATH?.trim());
    const connection = await prisma.vaultConnection.findUnique({
      where: { userId: request.userId! },
      include: { _count: { select: { notes: true, attachments: true, tags: true } } },
    });
    let available = false;
    if (configured) {
      try { await validateVaultRoot(); available = true; } catch { available = false; }
    }
    response.json({ configured, available, connection });
  } catch (error) { next(error); }
});

vaultRouter.post('/connect', async (request, response, next) => {
  try { response.status(201).json({ connection: await connectVault(request.userId!) }); }
  catch (error) { next(error); }
});

vaultRouter.post('/refresh', async (request, response, next) => {
  try { response.json({ summary: await refreshVault(request.userId!) }); }
  catch (error) { next(error); }
});

vaultRouter.delete('/connection', async (request, response, next) => {
  try {
    const connection = await prisma.vaultConnection.findUnique({ where: { userId: request.userId! } });
    if (!connection) return response.status(204).end();
    if (request.body?.clearMetadata === true) await prisma.vaultConnection.delete({ where: { id: connection.id } });
    else await prisma.vaultConnection.update({ where: { id: connection.id }, data: { status: 'DISCONNECTED' } });
    response.status(204).end();
  } catch (error) { next(error); }
});

vaultRouter.get('/attachments/:id', async (request, response, next) => {
  try {
    const { attachment, absolute } = await readAttachmentFile(request.userId!, Number(request.params.id));
    await fs.access(absolute);
    response.type(attachment.mimeType);
    response.setHeader('Content-Disposition', 'inline');
    response.sendFile(absolute);
  } catch (error) { next(error); }
});
