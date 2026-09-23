# StudyFlow Project Status

## Current release

StudyFlow is a working local study planner with authentication, daily and weekly planning, inbox/backlog management, progress summaries, settings, and a read-only Obsidian integration.

## Obsidian integration

Implemented:

- Git-ignored local vault configuration.
- Canonical path validation and directory-traversal prevention.
- Symlink exclusion and escape rejection.
- Explicit Connect, Refresh, Disconnect, and Clear Index actions.
- Incremental metadata indexing for Markdown, frontmatter, tags, properties, links, backlinks, Maps, templates, and approved attachments.
- Safe on-demand Markdown preview with raw HTML disabled.
- Search, folder, tag, property, and sorting controls.
- Open in Obsidian links.
- Many-to-many task-note associations.
- Missing and unavailable note handling.
- Non-destructive Prisma migration.
- Synthetic security and ownership tests.

The vault remains read-only. Complete note bodies are not stored in SQLite.

## Deliberately deferred

- Filesystem watching and automatic synchronization.
- Markdown editing or frontmatter rewriting.
- Study journal sessions.
- Spaced repetition.
- AI-generated quizzes.
- Dataview or embedded-script execution.
- Subject-folder mapping UI.
- Advanced full-text search.

## Verification

- Backend and frontend production build passes.
- Ten automated tests pass.
- npm audit reports zero known vulnerabilities.
- The original StudyFlow database was backed up locally before migration.
