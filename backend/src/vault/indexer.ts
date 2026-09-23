import crypto from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { prisma } from '../db.js';
import { parseNote, type ParsedLink, type ParsedNote } from './parser.js';
import { allowedAttachmentTypes, normalizeRelative, resolveInsideVault, validateVaultRoot } from './path-policy.js';

interface ScannedAttachment {
  relativePath: string; normalizedPath: string; extension: string; mimeType: string; size: number; modifiedAt: Date;
}

async function scanVault(root: string) {
  const notes: ParsedNote[] = [];
  const attachments: ScannedAttachment[] = [];
  const warnings: string[] = [];

  async function walk(directory: string) {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      const absolute = path.join(directory, entry.name);
      const relativePath = normalizeRelative(path.relative(root, absolute));
      if (entry.isSymbolicLink()) { warnings.push('Skipped symbolic link: ' + relativePath); continue; }
      if (entry.isDirectory()) { await walk(absolute); continue; }
      const extension = path.extname(entry.name).toLocaleLowerCase();
      if (extension === '.md') {
        try {
          const [content, stat] = await Promise.all([fs.readFile(absolute, 'utf8'), fs.stat(absolute)]);
          const parsed = parseNote(relativePath, content, stat.size, stat.mtime);
          notes.push(parsed);
          warnings.push(...parsed.warnings.map((warning) => relativePath + ': ' + warning));
        } catch { warnings.push('Could not read note: ' + relativePath); }
      } else if (allowedAttachmentTypes[extension]) {
        const stat = await fs.stat(absolute);
        attachments.push({ relativePath, normalizedPath: relativePath.toLocaleLowerCase(), extension, mimeType: allowedAttachmentTypes[extension], size: stat.size, modifiedAt: stat.mtime });
      }
    }
  }

  await walk(root);
  return { notes, attachments, warnings };
}

export async function connectVault(userId: number) {
  const root = await validateVaultRoot();
  const rootFingerprint = crypto.createHash('sha256').update(root).digest('hex');
  return prisma.vaultConnection.upsert({
    where: { userId },
    create: { userId, name: path.basename(root), rootFingerprint, status: 'READY' },
    update: { name: path.basename(root), rootFingerprint, status: 'READY', lastError: null },
  });
}

function withoutMd(value: string) { return value.replace(/\.md$/i, ''); }
function basenameKey(value: string) { return path.posix.basename(withoutMd(value)).toLocaleLowerCase(); }

function resolveLink(
  link: ParsedLink,
  sourcePath: string,
  noteExact: Map<string, number>,
  noteBasenames: Map<string, number[]>,
  attachmentExact: Map<string, number>,
  attachmentBasenames: Map<string, number[]>,
) {
  let target = link.normalizedTarget;
  try {
    target = decodeURIComponent(target);
  } catch { /* Keep malformed percent escapes literal so one link cannot abort an index. */ }
  target = target.replace(/\\/g, '/');
  const sourceFolder = path.posix.dirname(sourcePath);
  const isAttachment = Boolean(path.posix.extname(target)) && !target.endsWith('.md');
  if (isAttachment) {
    const local = normalizeRelative(path.posix.normalize(path.posix.join(sourceFolder, target))).toLocaleLowerCase();
    const exact = attachmentExact.get(local) ?? attachmentExact.get(target);
    const candidates = attachmentBasenames.get(path.posix.basename(target)) ?? [];
    return { targetAttachmentId: exact ?? (candidates.length === 1 ? candidates[0] : null), targetNoteId: null };
  }
  target = withoutMd(target);
  const local = withoutMd(normalizeRelative(path.posix.normalize(path.posix.join(sourceFolder, target))).toLocaleLowerCase());
  const exact = noteExact.get(local) ?? noteExact.get(withoutMd(target));
  const candidates = noteBasenames.get(basenameKey(target)) ?? [];
  return { targetNoteId: exact ?? (candidates.length === 1 ? candidates[0] : null), targetAttachmentId: null };
}

export async function refreshVault(userId: number) {
  const connection = await connectVault(userId);
  await prisma.vaultConnection.update({ where: { id: connection.id }, data: { status: 'INDEXING', lastError: null } });
  try {
    const root = await validateVaultRoot();
    const scanned = await scanVault(root);
    const indexedAt = new Date();

    const summary = await prisma.$transaction(async (database) => {
      const existing = await database.vaultNote.findMany({ where: { vaultId: connection.id } });
      const exact = new Map(existing.map((note) => [note.normalizedPath, note]));
      const hashes = new Map<string, typeof existing>();
      for (const note of existing) hashes.set(note.contentHash, [...(hashes.get(note.contentHash) ?? []), note]);
      const matched = new Set<number>();
      const noteIds = new Map<string, number>();

      await database.vaultNote.updateMany({ where: { vaultId: connection.id }, data: { available: false } });
      await database.vaultAttachment.updateMany({ where: { vaultId: connection.id }, data: { available: false } });

      for (const note of scanned.notes) {
        const current = exact.get(note.normalizedPath);
        const movedCandidates = (hashes.get(note.contentHash) ?? []).filter((candidate) => !matched.has(candidate.id));
        const moved = !current && movedCandidates.length === 1 ? movedCandidates[0] : null;
        const data = {
          relativePath: note.relativePath, normalizedPath: note.normalizedPath, title: note.title, folder: note.folder,
          contentHash: note.contentHash, size: note.size, modifiedAt: note.modifiedAt,
          metadataJson: JSON.stringify(note.metadata), aliasesJson: JSON.stringify(note.aliases),
          isMap: note.isMap, isTemplate: note.isTemplate, available: true, indexedAt,
        };
        const saved = current || moved
          ? await database.vaultNote.update({ where: { id: (current ?? moved)!.id }, data })
          : await database.vaultNote.create({ data: { vaultId: connection.id, ...data } });
        matched.add(saved.id);
        noteIds.set(note.normalizedPath, saved.id);
      }

      for (const attachment of scanned.attachments) {
        await database.vaultAttachment.upsert({
          where: { vaultId_normalizedPath: { vaultId: connection.id, normalizedPath: attachment.normalizedPath } },
          create: { vaultId: connection.id, ...attachment },
          update: { ...attachment, available: true },
        });
      }

      const availableNotes = await database.vaultNote.findMany({ where: { vaultId: connection.id, available: true } });
      const availableAttachments = await database.vaultAttachment.findMany({ where: { vaultId: connection.id, available: true } });
      const ids = availableNotes.map((note) => note.id);
      await database.vaultLink.deleteMany({ where: { sourceNoteId: { in: ids } } });
      await database.vaultProperty.deleteMany({ where: { noteId: { in: ids } } });
      await database.vaultNoteTag.deleteMany({ where: { noteId: { in: ids } } });

      const noteExact = new Map<string, number>();
      const noteBasenames = new Map<string, number[]>();
      for (const note of availableNotes) {
        noteExact.set(withoutMd(note.normalizedPath), note.id);
        const key = basenameKey(note.normalizedPath);
        noteBasenames.set(key, [...(noteBasenames.get(key) ?? []), note.id]);
      }
      const attachmentExact = new Map(availableAttachments.map((item) => [item.normalizedPath, item.id]));
      const attachmentBasenames = new Map<string, number[]>();
      for (const item of availableAttachments) {
        const key = path.posix.basename(item.normalizedPath);
        attachmentBasenames.set(key, [...(attachmentBasenames.get(key) ?? []), item.id]);
      }

      for (const note of scanned.notes) {
        const noteId = noteIds.get(note.normalizedPath)!;
        if (note.properties.length) await database.vaultProperty.createMany({ data: note.properties.map((property) => ({ noteId, ...property })) });
        for (const tag of note.tags) {
          const savedTag = await database.vaultTag.upsert({
            where: { vaultId_normalizedName: { vaultId: connection.id, normalizedName: tag.normalizedName } },
            create: { vaultId: connection.id, ...tag },
            update: { displayName: tag.displayName },
          });
          await database.vaultNoteTag.create({ data: { noteId, tagId: savedTag.id } });
        }
        for (const link of note.links) {
          const target = resolveLink(link, note.normalizedPath, noteExact, noteBasenames, attachmentExact, attachmentBasenames);
          await database.vaultLink.create({ data: {
            sourceNoteId: noteId, ...target, rawTarget: link.rawTarget, normalizedTarget: link.normalizedTarget,
            heading: link.heading, blockId: link.blockId, kind: link.kind, embedded: link.embedded,
            resolved: Boolean(target.targetNoteId || target.targetAttachmentId),
          } });
        }
      }

      await database.vaultConnection.update({ where: { id: connection.id }, data: { status: 'READY', lastIndexedAt: indexedAt, lastError: null } });
      return { notes: scanned.notes.length, attachments: scanned.attachments.length, warnings: scanned.warnings.length };
    }, { timeout: 120_000 });

    return { ...summary, warningDetails: scanned.warnings.slice(0, 20) };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Vault refresh failed.';
    await prisma.vaultConnection.update({ where: { id: connection.id }, data: { status: 'ERROR', lastError: message } });
    throw error;
  }
}

export async function readNoteFile(userId: number, noteId: number) {
  const note = await prisma.vaultNote.findFirst({ where: { id: noteId, vault: { userId } } });
  if (!note || !note.available) throw new Error('Note is unavailable.');
  const root = await validateVaultRoot();
  const absolute = await resolveInsideVault(root, note.relativePath);
  const content = await fs.readFile(absolute, 'utf8');
  return { note, parsed: parseNote(note.relativePath, content, note.size, note.modifiedAt) };
}

export async function readAttachmentFile(userId: number, attachmentId: number) {
  const attachment = await prisma.vaultAttachment.findFirst({ where: { id: attachmentId, vault: { userId }, available: true } });
  if (!attachment || !allowedAttachmentTypes[attachment.extension]) throw new Error('Attachment is unavailable.');
  const root = await validateVaultRoot();
  const absolute = await resolveInsideVault(root, attachment.relativePath);
  return { attachment, absolute };
}
