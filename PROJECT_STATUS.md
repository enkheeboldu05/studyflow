# StudyFlow Project Status

## Current release

StudyFlow is a working local study planner with authentication, daily, weekly, monthly, and yearly planning, inbox/backlog management, progress summaries, settings, and study-time tracking.

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
- Subject archive, restore, and deletion synchronize the same shared state; invalid Inbox filters clear automatically.
- Theme changes, task creation/updates, and quick task capture show concise success messages.
- Aubergine Terminal is available alongside Light, Dark Navy, and System themes and persists locally without a database migration.
- Existing tasks open in a compact read-only details dialog from Today, Weekly Planner, Calendar, and Inbox.
- Task Details supports complete/reopen, edit, and delete.
- The editor separates primary fields, scheduling, and collapsible additional options with a sticky action footer.
- Unsaved changes require confirmation before the editor closes.

## Study log

- A dedicated weekly logger stores daily study targets and manually adjustable actual time.
- A persistent single-session timer supports start, pause, resume, and end; ending adds rounded minutes to the start date.
- Weekly totals are calculated from daily records and the page supports previous, current, and next week navigation.
- A monthly study-history calendar shows actual time per day, study-intensity shading, monthly totals, and studied-day counts.
- Previous/next controls and a native month/year picker allow direct access to older records without a practical UI time limit.
- History queries accept a validated, user-isolated date range of up to one year while preserving the original weekly API behavior.
- The additive SQLite migration was applied after creating a local database backup.

## Deliberately deferred

- Detailed study-session history and journals.
- Spaced repetition.
- AI-generated quizzes.

## Verification

- Backend and frontend production builds pass.
- Eight API tests pass, covering authentication, task lifecycle and ownership, deadlines, recurrence, subjects, study logging, removed endpoints, and legacy backup compatibility.
- The integration removal migration drops only cached integration metadata and resets the removed Notes default page to Today.

## Known limitations

- The timer stores one active session and daily aggregate totals, not individual session records; completed time is rounded to the nearest minute and assigned to the date the session started.
- Browser-level visual checks have not been performed for this removal.
