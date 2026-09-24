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
      await writeFile(path.join(root, 'Algorithms.md'), '# Algorithms\n\n#graph-theory\n\nLinked to [[Databases]] and [[bad%ZZlink]].\n');
      await writeFile(path.join(root, 'Databases.md'), '# Databases\n\n| Form | Rule |\n| --- | --- |\n| 3NF | No transitive dependency |\n');

      const account = await signup('workflow@example.com', 'Workflow');
      const cookie = account.headers['set-cookie'];
      const user = await prisma.user.findUniqueOrThrow({ where: { email: 'workflow@example.com' } });
      await refreshVault(user.id);
      const originalNotes = await prisma.vaultNote.findMany({ where: { vault: { userId: user.id }, available: true }, orderBy: { title: 'asc' } });
      expect(originalNotes).toHaveLength(2);
      const tagSearch = await request(app).get('/api/notes?search=graph-theory').set('Cookie', cookie);
      expect(tagSearch.body.notes).toHaveLength(1);
      expect(tagSearch.body.notes[0].title).toBe('Algorithms');

      const taskResponse = await request(app).post('/api/tasks').set('Cookie', cookie).send({ title: 'Review linked material', scheduledDate: '2026-09-23', dueDate: '2026-09-30' });
      const taskId = taskResponse.body.task.id as number;
      expect(taskResponse.body.task.scheduledDate).toContain('2026-09-23');
      expect(taskResponse.body.task.dueDate).toContain('2026-09-30');
      for (const note of originalNotes) {
        const link = await request(app).post('/api/tasks/' + taskId + '/notes').set('Cookie', cookie).send({ noteId: note.id });
        expect(link.status).toBe(201);
      }

      const reopened = await request(app).get('/api/tasks/' + taskId + '/notes').set('Cookie', cookie);
      expect(reopened.body.notes.map((note: { title: string }) => note.title)).toEqual(['Algorithms', 'Databases']);
      expect(reopened.body.notes[0].vault.name).toBeTruthy();
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

  it('creates the next dated occurrence for planner and calendar views', async () => {
    const account = await signup('recurring@example.com', 'Recurring');
    const cookie = account.headers['set-cookie'];
    const created = await request(app).post('/api/tasks').set('Cookie', cookie).send({
      title: 'Weekly review',
      scheduledDate: '2026-09-23',
      dueDate: '2026-09-24',
      recurrence: 'WEEKLY',
    });
    const completed = await request(app).patch('/api/tasks/' + created.body.task.id).set('Cookie', cookie).send({ status: 'COMPLETED' });
    expect(completed.status).toBe(200);
    const listed = await request(app).get('/api/tasks').set('Cookie', cookie);
    const next = listed.body.tasks.find((task: { id: number }) => task.id !== created.body.task.id);
    expect(next.scheduledDate).toContain('2026-09-30');
    expect(next.dueDate).toContain('2026-10-01');
    expect(next.recurrence).toBe('WEEKLY');
  });

  it('validates and persists subject lifecycle changes without breaking task associations', async () => {
    const account = await signup('subjects@example.com', 'Subjects');
    const cookie = account.headers['set-cookie'];

    const empty = await request(app).post('/api/subjects').set('Cookie', cookie).send({ name: '   ', description: '', color: '#344b71' });
    expect(empty.status).toBe(400);

    const created = await request(app).post('/api/subjects').set('Cookie', cookie).send({ name: '  Distributed Systems  ', description: '', color: '#4f6b95' });
    expect(created.status).toBe(201);
    expect(created.body.subject).toMatchObject({ name: 'Distributed Systems', color: '#4f6b95', _count: { tasks: 0 } });
    const subjectId = created.body.subject.id as number;

    const duplicate = await request(app).post('/api/subjects').set('Cookie', cookie).send({ name: 'Distributed Systems', description: '', color: '#4f6b95' });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error).toContain('already exists');

    const task = await request(app).post('/api/tasks').set('Cookie', cookie).send({ title: 'Review consensus', subjectId });
    expect(task.status).toBe(201);
    expect(task.body.task.subject.name).toBe('Distributed Systems');

    const renamed = await request(app).patch('/api/subjects/' + subjectId).set('Cookie', cookie).send({ name: 'Advanced Distributed Systems' });
    expect(renamed.status).toBe(200);
    expect(renamed.body.subject).toMatchObject({ name: 'Advanced Distributed Systems', _count: { tasks: 1 } });

    const reloaded = await request(app).get('/api/subjects?archived=true').set('Cookie', cookie);
    expect(reloaded.body.subjects.filter((subject: { id: number }) => subject.id === subjectId)).toHaveLength(1);
    expect(reloaded.body.subjects.find((subject: { id: number }) => subject.id === subjectId).name).toBe('Advanced Distributed Systems');
    const tasks = await request(app).get('/api/tasks').set('Cookie', cookie);
    expect(tasks.body.tasks.find((item: { id: number }) => item.id === task.body.task.id).subject.name).toBe('Advanced Distributed Systems');

    const archived = await request(app).patch('/api/subjects/' + subjectId).set('Cookie', cookie).send({ archived: true });
    expect(archived.status).toBe(200);
    expect(archived.body.subject.archivedAt).toBeTruthy();
    expect(await prisma.task.count({ where: { id: task.body.task.id, subjectId } })).toBe(1);

    const inUseDelete = await request(app).delete('/api/subjects/' + subjectId).set('Cookie', cookie);
    expect(inUseDelete.status).toBe(409);

    const unused = await request(app).post('/api/subjects').set('Cookie', cookie).send({ name: 'Temporary', description: '', color: '#77869a' });
    const removed = await request(app).delete('/api/subjects/' + unused.body.subject.id).set('Cookie', cookie);
    expect(removed.status).toBe(204);
    expect(await prisma.subject.count({ where: { id: unused.body.subject.id } })).toBe(0);
  });

});
