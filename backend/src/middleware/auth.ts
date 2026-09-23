import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { prisma } from '../db.js';

export const SESSION_COOKIE = 'studyflow_session';
const SESSION_DAYS = 30;

export async function createSession(userId: number, response: Response) {
  const id = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await prisma.authSession.create({ data: { id, userId, expiresAt } });
  response.cookie(SESSION_COOKIE, id, {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    expires: expiresAt,
    path: '/',
  });
}

export async function requireAuth(request: Request, response: Response, next: NextFunction) {
  try {
    const token = request.cookies?.[SESSION_COOKIE];
    if (!token) return response.status(401).json({ error: 'Please log in to continue.' });
    const session = await prisma.authSession.findUnique({ where: { id: token } });
    if (!session || session.expiresAt <= new Date()) {
      if (session) await prisma.authSession.delete({ where: { id: token } });
      response.clearCookie(SESSION_COOKIE);
      return response.status(401).json({ error: 'Your session has expired. Please log in again.' });
    }
    request.userId = session.userId;
    next();
  } catch (error) {
    next(error);
  }
}
