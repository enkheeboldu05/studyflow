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

## Read-only Obsidian integration

StudyFlow can index an explicitly configured local Obsidian backup vault without modifying it.

1. Set the vault path in the Git-ignored `backend/.env.vault` file:

```env
OBSIDIAN_VAULT_PATH="/absolute/path/to/authorized/vault"
```

2. Start StudyFlow and open **Settings → Obsidian notes**.
3. Select **Connect vault**, then **Refresh index**.
4. Open **Notes** in the sidebar to browse and preview indexed notes.
5. Edit a StudyFlow task to associate one or more indexed notes.

The refresh action ignores hidden directories and symbolic links. Only metadata is stored in SQLite; Markdown content is read on demand. Raw HTML, Dataview, Excalidraw scripts, and code inside notes are never executed.

Supported attachment responses are limited to PNG, JPG/JPEG, GIF, WebP, and PDF. The application does not edit, rename, move, or delete files in the vault.

If the vault becomes unavailable, StudyFlow planning continues to work and existing metadata remains available. Reconnect the drive and refresh the index when convenient.

