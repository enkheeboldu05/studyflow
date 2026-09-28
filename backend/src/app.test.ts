import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from './app.js';
import { prisma } from './db.js';

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

  it('removes integration endpoints and restores legacy backups to Today', async () => {
    const account = await signup('legacy@example.com', 'Legacy');
    const cookie = account.headers['set-cookie'];
    for (const endpoint of ['/api/vault/status', '/api/notes', '/api/tasks/1/notes']) {
      expect((await request(app).get(endpoint).set('Cookie', cookie)).status).toBe(404);
    }
    const restored = await request(app).post('/api/backup/restore').set('Cookie', cookie).send({
      data: { subjects: [], tasks: [{ title: 'Restored task' }], settings: { defaultPage: 'notes', theme: 'DARK' } },
    });
    expect(restored.status).toBe(200);
    const me = await request(app).get('/api/auth/me').set('Cookie', cookie);
    expect(me.body.user.settings).toMatchObject({ defaultPage: 'today', theme: 'DARK' });
    const tasks = await request(app).get('/api/tasks').set('Cookie', cookie);
    expect(tasks.body.tasks[0].title).toBe('Restored task');
    expect((await request(app).patch('/api/settings').set('Cookie', cookie).send({ defaultPage: 'notes' })).status).toBe(400);
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

  it('stores weekly study logs and turns a persistent timer into actual minutes', async () => {
    const account = await signup('logger@example.com', 'Logger');
    const other = await signup('other-logger@example.com', 'Other Logger');
    const cookie = account.headers['set-cookie'];
    const date = '2026-09-24';

    const manual = await request(app).patch('/api/study-log/days/' + date).set('Cookie', cookie).send({ targetMinutes: 120, actualMinutes: 60 });
    expect(manual.status).toBe(200);
    expect(manual.body.log).toMatchObject({ date, targetMinutes: 120, actualMinutes: 60 });

    const week = await request(app).get('/api/study-log?start=2026-09-21').set('Cookie', cookie);
    expect(week.status).toBe(200);
    expect(week.body.logs).toHaveLength(1);
    const privateWeek = await request(app).get('/api/study-log?start=2026-09-21').set('Cookie', other.headers['set-cookie']);
    expect(privateWeek.body.logs).toHaveLength(0);
    await request(app).patch('/api/study-log/days/2025-01-15').set('Cookie', cookie).send({ actualMinutes: 75 });
    await request(app).patch('/api/study-log/days/2025-01-16').set('Cookie', other.headers['set-cookie']).send({ actualMinutes: 240 });
    const history = await request(app).get('/api/study-log?start=2025-01-01&end=2025-01-31').set('Cookie', cookie);
    expect(history.status).toBe(200);
    expect(history.body.logs).toHaveLength(1);
    expect(history.body.logs[0]).toMatchObject({ date: '2025-01-15', actualMinutes: 75 });
    expect((await request(app).get('/api/study-log?start=2025-02-01&end=2025-01-01').set('Cookie', cookie)).status).toBe(400);
    expect((await request(app).get('/api/study-log?start=2024-01-01&end=2025-12-31').set('Cookie', cookie)).status).toBe(400);


    const started = await request(app).post('/api/study-log/timer/start').set('Cookie', cookie).send({ date });
    expect(started.status).toBe(201);
    const duplicate = await request(app).post('/api/study-log/timer/start').set('Cookie', cookie).send({ date });
    expect(duplicate.status).toBe(409);

    const user = await prisma.user.findUniqueOrThrow({ where: { email: 'logger@example.com' } });
    await prisma.studyTimer.update({ where: { userId: user.id }, data: { startedAt: new Date(Date.now() - 90_000) } });
    const paused = await request(app).post('/api/study-log/timer/pause').set('Cookie', cookie);
    expect(paused.status).toBe(200);
    expect(paused.body.timer.status).toBe('PAUSED');
    expect(paused.body.timer.elapsedSeconds).toBeGreaterThanOrEqual(89);

    const resumed = await request(app).post('/api/study-log/timer/resume').set('Cookie', cookie);
    expect(resumed.body.timer.status).toBe('RUNNING');
    await prisma.studyTimer.update({ where: { userId: user.id }, data: { startedAt: new Date(Date.now() - 30_000) } });
    const ended = await request(app).post('/api/study-log/timer/end').set('Cookie', cookie);
    expect(ended.status).toBe(200);
    expect(ended.body.loggedMinutes).toBe(2);
    expect(ended.body.log.actualMinutes).toBe(62);
    expect(await prisma.studyTimer.count({ where: { userId: user.id } })).toBe(0);

    const adjusted = await request(app).patch('/api/study-log/days/' + date).set('Cookie', cookie).send({ actualMinutes: 180 });
    expect(adjusted.body.log.actualMinutes).toBe(180);
    expect((await request(app).patch('/api/study-log/days/not-a-date').set('Cookie', cookie).send({ actualMinutes: 10 })).status).toBe(400);
  });

});
