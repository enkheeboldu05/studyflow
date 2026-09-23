import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../db.js';
import { createSession, requireAuth, SESSION_COOKIE } from '../middleware/auth.js';
import { loginSchema, signupSchema } from '../lib/schemas.js';

export const authRouter = Router();

const starterSubjects = [
  { name: 'University', description: 'Courses and assignments', color: '#65725b' },
  { name: 'SQLD', description: 'SQL Developer certification', color: '#bb6b47' },
  { name: 'Algorithms', description: 'Baekjoon and problem solving', color: '#52778c' },
  { name: 'Personal learning', description: 'Curiosity and independent study', color: '#8a6d8d' },
];

authRouter.post('/signup', async (request, response, next) => {
  try {
    const parsed = signupSchema.safeParse(request.body);
    if (!parsed.success) return response.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid account details.' });

    const existing = await prisma.user.findFirst({
      where: { OR: [{ email: parsed.data.email }, { username: parsed.data.username }] },
    });
    if (existing) return response.status(409).json({ error: 'That email or username is already in use.' });

    const user = await prisma.user.create({
      data: {
        username: parsed.data.username,
        email: parsed.data.email,
        passwordHash: await bcrypt.hash(parsed.data.password, 12),
        settings: { create: {} },
        subjects: { create: starterSubjects },
      },
      select: { id: true, username: true, email: true },
    });
    await createSession(user.id, response);
    response.status(201).json({ user });
  } catch (error) {
    next(error);
  }
});

authRouter.post('/login', async (request, response, next) => {
  try {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) return response.status(400).json({ error: 'Enter a valid email and password.' });
    const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    if (!user || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) {
      return response.status(401).json({ error: 'The email or password is incorrect.' });
    }
    await createSession(user.id, response);
    response.json({ user: { id: user.id, username: user.username, email: user.email } });
  } catch (error) {
    next(error);
  }
});

authRouter.post('/logout', async (request, response, next) => {
  try {
    const token = request.cookies?.[SESSION_COOKIE];
    if (token) await prisma.authSession.deleteMany({ where: { id: token } });
    response.clearCookie(SESSION_COOKIE, { path: '/' });
    response.status(204).end();
  } catch (error) {
    next(error);
  }
});

authRouter.get('/me', requireAuth, async (request, response, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: request.userId },
      select: { id: true, username: true, email: true, settings: true },
    });
    response.json({ user });
  } catch (error) {
    next(error);
  }
});
