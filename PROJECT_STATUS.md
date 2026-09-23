# StudyFlow Project Status

## Current release

StudyFlow is a working local study planner with authentication, daily, weekly, monthly, and yearly planning, inbox/backlog management, progress summaries, settings, and a read-only Obsidian integration.

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
- Dominant Markdown reader with collapsible folders and note list.
- Resizable note list, tabbed note inspector, and distraction-free reading mode.
- Responsive rendering for paragraphs, tables, images, and code blocks.
- Clear total/filtered note counts, long-path truncation, search clearing, and contextual empty states.
- Separate unresolved-note and missing-attachment categories in the note inspector.
- Non-destructive Prisma migration.
- Synthetic security and ownership tests.

The vault remains read-only. Complete note bodies are not stored in SQLite.

## Calendar

- Full six-week month grid with adjacent-month dates.
- Drag-and-drop rescheduling between calendar days while preserving deadlines.
- Quick task creation and editing from each day.
- Compact twelve-month year overview with task-density indicators.
- Month/year navigation, Today shortcut, light/dark styling, and responsive mobile overflow.

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

- Backend and frontend production builds pass.
- Eleven automated tests pass.
- A synthetic task linked to two notes remained associated after save/reopen and note rename.
- Linked tasks are visible from note detail; unlinking removes only the association and leaves the note intact.
- Deleted notes become unavailable without deleting their cached record; a temporarily unavailable vault preserves the index.
- The authorized development vault refreshed read-only: 464 notes, 1,881 attachments, and zero parser warnings.
- The current index contains 164 unresolved internal note links: 139 Markdown links and 25 wikilinks. No unresolved embeds were found.
- Malformed percent escapes are now retained as unresolved links instead of aborting a refresh.
- Path traversal and symlink-escape regression tests pass.
- The Windows obsidian:// handler is registered and a WSL-to-Windows launch check completed successfully.
- The local vault configuration and SQLite databases are Git-ignored. No Markdown bodies or attachments are present in tracked project files.
- No integration code sends notes, attachments, paths, or metadata to an external service.
- npm audit reports zero known vulnerabilities.
- The original StudyFlow database was backed up locally before migration.

## Known limitations / approval needed

- The 164 unresolved internal links appear to be missing or non-indexed targets rather than parser failures; their filenames were deliberately omitted from this report for privacy.
- Browser-level visual checks still need a brief manual pass at the user's preferred desktop and phone widths. Automated builds cover compilation, not pixel-level rendering.
- Automatic filesystem watching remains deferred. Refresh is still explicit by design.
