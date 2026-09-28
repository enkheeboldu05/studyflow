# StudyFlow

StudyFlow is a local-first personal study planner. It helps you capture tasks, review unfinished work each morning, plan a flexible week, and see progress without forcing every hour into a schedule.

## Stack

- React, TypeScript, Vite and Tailwind CSS
- Node.js, TypeScript and Express
- Prisma ORM with a local SQLite database
- Database-backed cookie sessions and bcrypt password hashing

## Prerequisites

- Ubuntu/WSL
- Node.js 20.19 or newer
- npm 10 or newer

Check with:

```bash
node --version
npm --version
```

## Install and initialize

```bash
cd ~/projects/studyflow
npm install
npm run db:migrate
```

The backend `.env` is already configured for local development. Use `backend/.env.example` when creating a fresh environment.

## Development

```bash
npm run dev
```

Open `http://127.0.0.1:5173`. The Express API runs at `http://127.0.0.1:3001`.

## Production-style local run

```bash
npm run build
npm start
```

Open `http://127.0.0.1:3001`.

## Tests

```bash
npm test
```

Tests use a separate `backend/prisma/test.db` and verify authentication, task lifecycle, schedule/deadline separation, and user ownership.

## Architecture

The React frontend sends JSON requests to Express. Express validates input, checks the database-backed session cookie, and queries SQLite through Prisma. Every task and subject carries a `userId`; all reads and writes filter by that ID.

`scheduledDate` describes when you intend to work. `dueDate` is the real deadline. Dragging a task only changes `scheduledDate`.

The main relationship is:

```text
User ──< Subject ──< Task
  ├────< Task
  ├────< AuthSession
  └───── UserSettings
```

Subjects with task history are archived rather than deleted. Deleting a task is explicit and asks for confirmation. JSON backups exclude password hashes.

## Database location

The local database is created at:

```text
backend/prisma/studyflow.db
```

It is ignored by Git. Use Settings → Your data to export a portable JSON backup.

## Troubleshooting

- If Prisma types are missing, run `npm run db:generate`.
- If the schema changes later, run `npm run db:migrate -w backend -- --name describe_the_change`.
- If port 5173 or 3001 is busy, stop the existing process before starting StudyFlow.
- Run npm inside WSL paths such as `~/projects/studyflow`, not through a Windows UNC path.
