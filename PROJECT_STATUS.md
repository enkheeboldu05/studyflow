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

## Task workflow and themes

- Weekly Planner and Calendar drops now confirm success on the destination after the server update completes.
- Subject creation updates the shared App state immediately after the API succeeds, making the subject available across navigation, task forms, Quick Add, and filters without reloading.
- Subject creation rejects blank and duplicate names with clear feedback and prevents double submission while saving.
- Subject archive, restore, and deletion synchronize the same shared state; invalid Inbox and Notes filters clear automatically.
- Theme changes, task creation/updates, and quick task capture show concise success messages.
- The superseded Notes page, duplicate note-picker rules, and legacy Notes layout selectors were removed.
- Aubergine Terminal is available alongside Light, Dark Navy, and System themes and persists locally without a database migration.
- Existing tasks open in a compact read-only details dialog from Today, Weekly Planner, Calendar, and Inbox.
- Task Details supports complete/reopen, edit, delete, and direct Obsidian note opening.
- The editor separates primary fields, scheduling, and collapsible additional options with a sticky action footer.
- Unsaved changes require confirmation before the editor closes.
- The note picker loads linked notes first and searches titles, paths, properties, and tags on demand.
- Adding or removing a task-note association never edits or deletes Markdown files.

## Study log

- A dedicated weekly logger stores daily study targets and manually adjustable actual time.
- A persistent single-session timer supports start, pause, resume, and end; ending adds rounded minutes to the start date.
- Weekly totals are calculated from daily records and the page supports previous, current, and next week navigation.
- A monthly study-history calendar shows actual time per day, study-intensity shading, monthly totals, and studied-day counts.
- Previous/next controls and a native month/year picker allow direct access to older records without a practical UI time limit.
- History queries accept a validated, user-isolated date range of up to one year while preserving the original weekly API behavior.
- The additive SQLite migration was applied after creating a local database backup.

## Deliberately deferred

- Filesystem watching and automatic synchronization.
- Markdown editing or frontmatter rewriting.
- Detailed study-session history and journals.
- Spaced repetition.
- AI-generated quizzes.
- Dataview or embedded-script execution.
- Subject-folder mapping UI.
- Advanced full-text search.

## Verification

- Backend and frontend production builds pass.
- Fourteen automated tests pass, including study-log timing, history ranges and isolation, subject lifecycle validation, tag-based note search, vault-name handoff, dated task-note creation, and recurring planner/calendar dates.
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

- The minimal timer stores one active session and daily aggregate totals, not individual session records; completed time is rounded to the nearest minute and assigned to the date the session started.
- The 164 unresolved internal links appear to be missing or non-indexed targets rather than parser failures; their filenames were deliberately omitted from this report for privacy.
- Browser-level visual checks still need a brief manual pass at the user's preferred desktop and phone widths. Automated builds cover compilation, not pixel-level rendering.
- Automatic filesystem watching remains deferred. Refresh is still explicit by design.
