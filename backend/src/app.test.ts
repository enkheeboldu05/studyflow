import { mkdtemp, rename, rm, unlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from './app.js';
import { prisma } from './db.js';
import { refreshVault } from './vault/indexer.js';

async function signup(email: string, username: string) {
  return request(app).post('/api/auth/signup').send({ email, username, password: 'password123' });
}

beforeEach(async () => {
  await prisma.authSession.deleteMany();
  await prisma.task.deleteMany();
  await prisma.subject.deleteMany();
  await prisma.userSettings.deleteMany();
  await prisma.user.deleteMany();
});

afterAll(async () => prisma.$disconnect());

describe('StudyFlow API', () => {
  it('creates an account, hashes its password, and restores the session', async () => {
    const response = await signup('jinwoo@example.com', 'Jinwoo');
    expect(response.status).toBe(201);
    expect(response.headers['set-cookie']?.[0]).toContain('HttpOnly');
    const user = await prisma.user.findUnique({ where: { email: 'jinwoo@example.com' } });
    expect(user?.passwordHash).not.toBe('password123');
    const me = await request(app).get('/api/auth/me').set('Cookie', response.headers['set-cookie']);
    expect(me.status).toBe(200);
    expect(me.body.user.username).toBe('Jinwoo');
  });

  it('creates, completes, reopens, and reschedules a task', async () => {
    const account = await signup('one@example.com', 'One');
    const cookie = account.headers['set-cookie'];
    const created = await request(app).post('/api/tasks').set('Cookie', cookie).send({ title: 'Review database normalization', scheduledDate: '2026-09-23', estimatedMinutes: 60 });
    expect(created.status).toBe(201);
    const id = created.body.task.id;
    const completed = await request(app).patch(`/api/tasks/${id}`).set('Cookie', cookie).send({ status: 'COMPLETED' });
    expect(completed.body.task.completedAt).toBeTruthy();
    const moved = await request(app).patch(`/api/tasks/${id}`).set('Cookie', cookie).send({ status: 'TODO', scheduledDate: '2026-09-24' });
    expect(moved.body.task.completedAt).toBeNull();
    expect(moved.body.task.rescheduleCount).toBe(1);
  });

  it('prevents one user from editing another user’s task', async () => {
    const first = await signup('first@example.com', 'First');
    const second = await signup('second@example.com', 'Second');
    const task = await request(app).post('/api/tasks').set('Cookie', first.headers['set-cookie']).send({ title: 'Private plan' });
    const attempt = await request(app).patch(`/api/tasks/${task.body.task.id}`).set('Cookie', second.headers['set-cookie']).send({ title: 'Changed' });
    expect(attempt.status).toBe(404);
  });

  it('keeps a deadline unchanged when a task is moved to another day', async () => {
    const account = await signup('date@example.com', 'Dates');
    const created = await request(app).post('/api/tasks').set('Cookie', account.headers['set-cookie']).send({ title: 'Assignment', scheduledDate: '2026-09-23', dueDate: '2026-09-30' });
    const moved = await request(app).patch(`/api/tasks/${created.body.task.id}`).set('Cookie', account.headers['set-cookie']).send({ scheduledDate: '2026-09-25' });
    expect(moved.body.task.scheduledDate).toContain('2026-09-25');
    expect(moved.body.task.dueDate).toContain('2026-09-30');
  });

  it('links only the signed-in user’s tasks and indexed notes', async () => {
    const first = await signup('notes@example.com', 'Notes');
    const second = await signup('other-notes@example.com', 'Other');
    const user = await prisma.user.findUniqueOrThrow({ where: { email: 'notes@example.com' } });
    const vault = await prisma.vaultConnection.create({ data: { userId: user.id, name: 'Test Vault', rootFingerprint: 'fixture' } });
    const note = await prisma.vaultNote.create({ data: {
      vaultId: vault.id, relativePath: 'Course/Normalization.md', normalizedPath: 'course/normalization.md',
      title: 'Normalization', folder: 'Course', contentHash: 'hash', size: 20, modifiedAt: new Date(),
    } });
    const task = await request(app).post('/api/tasks').set('Cookie', first.headers['set-cookie']).send({ title: 'Review databases' });
    const linked = await request(app).post('/api/tasks/' + task.body.task.id + '/notes').set('Cookie', first.headers['set-cookie']).send({ noteId: note.id });
    expect(linked.status).toBe(201);
    const listed = await request(app).get('/api/tasks/' + task.body.task.id + '/notes').set('Cookie', first.headers['set-cookie']);
    expect(listed.body.notes[0].title).toBe('Normalization');
    const forbidden = await request(app).post('/api/tasks/' + task.body.task.id + '/notes').set('Cookie', second.headers['set-cookie']).send({ noteId: note.id });
    expect(forbidden.status).toBe(404);
  });

  it('preserves multi-note task links through refresh, rename, unlink, deletion, and temporary vault loss', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'studyflow-vault-'));
    const offlineRoot = root + '-offline';
    process.env.OBSIDIAN_VAULT_PATH = root;
    try {
      await writeFile(path.join(root, 'Algorithms.md'), '# Algorithms\n\nLinked to [[Databases]] and [[bad%ZZlink]].\n');
      await writeFile(path.join(root, 'Databases.md'), '# Databases\n\n| Form | Rule |\n| --- | --- |\n| 3NF | No transitive dependency |\n');

      const account = await signup('workflow@example.com', 'Workflow');
      const cookie = account.headers['set-cookie'];
      const user = await prisma.user.findUniqueOrThrow({ where: { email: 'workflow@example.com' } });
      await refreshVault(user.id);
      const originalNotes = await prisma.vaultNote.findMany({ where: { vault: { userId: user.id }, available: true }, orderBy: { title: 'asc' } });
      expect(originalNotes).toHaveLength(2);

      const taskResponse = await request(app).post('/api/tasks').set('Cookie', cookie).send({ title: 'Review linked material' });
      const taskId = taskResponse.body.task.id as number;
      for (const note of originalNotes) {
        const link = await request(app).post('/api/tasks/' + taskId + '/notes').set('Cookie', cookie).send({ noteId: note.id });
        expect(link.status).toBe(201);
      }

      const reopened = await request(app).get('/api/tasks/' + taskId + '/notes').set('Cookie', cookie);
      expect(reopened.body.notes.map((note: { title: string }) => note.title)).toEqual(['Algorithms', 'Databases']);
      const databases = originalNotes.find((note) => note.title === 'Databases')!;
      const noteView = await request(app).get('/api/notes/' + databases.id).set('Cookie', cookie);
      expect(noteView.body.note.taskLinks[0].task.title).toBe('Review linked material');

      const algorithms = originalNotes.find((note) => note.title === 'Algorithms')!;
      await rename(path.join(root, 'Algorithms.md'), path.join(root, 'Computer Science Algorithms.md'));
      await refreshVault(user.id);
      const renamed = await prisma.vaultNote.findUniqueOrThrow({ where: { id: algorithms.id } });
      expect(renamed.relativePath).toBe('Computer Science Algorithms.md');
      expect(await prisma.taskNote.count({ where: { taskId, noteId: algorithms.id } })).toBe(1);

      const unlinked = await request(app).delete('/api/tasks/' + taskId + '/notes/' + databases.id).set('Cookie', cookie);
      expect(unlinked.status).toBe(204);
      expect(await prisma.vaultNote.count({ where: { id: databases.id } })).toBe(1);
      const afterUnlink = await request(app).get('/api/notes/' + databases.id).set('Cookie', cookie);
      expect(afterUnlink.body.note.taskLinks).toHaveLength(0);

      await unlink(path.join(root, 'Computer Science Algorithms.md'));
      await refreshVault(user.id);
      expect((await prisma.vaultNote.findUniqueOrThrow({ where: { id: algorithms.id } })).available).toBe(false);

      await rename(root, offlineRoot);
      await expect(refreshVault(user.id)).rejects.toThrow();
      expect(await prisma.vaultNote.count({ where: { vault: { userId: user.id } } })).toBe(2);
      await rename(offlineRoot, root);
    } finally {
      delete process.env.OBSIDIAN_VAULT_PATH;
      await rm(root, { recursive: true, force: true });
      await rm(offlineRoot, { recursive: true, force: true });
    }
  });

});
