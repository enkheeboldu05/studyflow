import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cookieParser from 'cookie-parser';
import express from 'express';
import helmet from 'helmet';
import { authRouter } from './routes/auth.js';
import { overviewRouter } from './routes/overview.js';
import { studyLogRouter } from './routes/study-log.js';
import { subjectsRouter } from './routes/subjects.js';
import { tasksRouter } from './routes/tasks.js';
import { requireAuth } from './middleware/auth.js';

export const app = express();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());

app.get('/api/health', (_request, response) => response.json({ status: 'ok' }));
app.use('/api/auth', authRouter);
app.use('/api/subjects', requireAuth, subjectsRouter);
app.use('/api/study-log', requireAuth, studyLogRouter);
app.use('/api/tasks', requireAuth, tasksRouter);
app.use('/api', requireAuth, overviewRouter);

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const frontendDist = path.resolve(currentDir, '../../frontend/dist');
app.use(express.static(frontendDist));
app.get(/^(?!\/api).*/, (_request, response) => response.sendFile(path.join(frontendDist, 'index.html')));

app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
  console.error(error);
  const message = error instanceof Error && error.message.includes('Unique constraint')
    ? 'That value is already in use.'
    : 'Something went wrong. Please try again.';
  response.status(500).json({ error: message });
});
