# StudyFlow Vault Analysis

## Scope and safety

This report covers the explicitly authorized backup vault supplied for StudyFlow integration. The scan was read-only.

- Hidden directories were excluded from note analysis, including `.obsidian`, `.git`, `.smart-env`, and plugin state.
- No vault files were created, edited, renamed, moved, or deleted.
- No complete note contents are reproduced here.
- No data was sent to an external service.
- Statistics involving link resolution are preliminary because Obsidian aliases, embeds, plugin syntax, and path resolution require a dedicated parser.

## Aggregate structure

| Metric | Observed |
| --- | ---: |
| Markdown notes | 464 |
| Note-bearing folders | 29 |
| Non-Markdown assets | 1,881 |
| Approximate words | 292,381 |
| Average words per note | 630 |
| Notes with frontmatter | 441 |
| Frontmatter blocks without a closing delimiter | 0 |
| Notes containing links | 415 |
| Wikilink occurrences | 2,534 |
| Markdown file-link occurrences | 139 |
| Duplicate filename titles | 1 group |
| Dataview code blocks | 41 |
| Inline Dataview expressions | 5 |
| Obsidian callouts | 98 |
| Candidate Maps/index notes | 49 |
| Notes in the Templates folder | 8 |

### Asset types

| Type | Count |
| --- | ---: |
| PNG | 1,640 |
| JPG | 240 |
| WebP | 1 |

The attachment volume is substantially larger than the note count. Attachment indexing should therefore remain metadata-only, with files served on demand and restricted to approved image types.

## Organizational conventions

The vault follows an Atlas-oriented structure rather than a conventional subject-folder-only structure:

- `Atlas/Maps` contains navigation and Map-of-Content material.
- `Atlas/Notes/Ideas` contains topic-oriented notes.
- `Atlas/Notes/Sources` contains source-oriented material such as books and media.
- Computer Science material is divided by both topic and academic term.
- `Atlas/Utilities/Templates` contains reusable note templates.
- `Atlas/Special` and `Atlas/Utilities` contain tool-specific content such as Excalidraw material.
- A small capture-oriented area exists outside the main Atlas hierarchy.

The largest note groups are programming, business, academic computer-science terms, database, cryptography, books, and media. Folder structure is meaningful but is not sufficient by itself to map every note to a StudyFlow subject.

## Frontmatter and properties

Frontmatter is a strong convention: 441 of 464 notes contain it.

| Property | Notes using it | Observed shapes |
| --- | ---: | --- |
| `tags` | 440 | Empty, text, list |
| `up` | 437 | Text, list, wikilink-oriented relationship |
| `encountered` | 238 | Text and date-like values |
| `type` | 106 | Text |
| `year` | 106 | Text and numeric values |
| `date` | 17 | Date-like values |
| `created` | 5 | Date-like and text values |
| `related` | 3 | Link-oriented text |
| `status` | 1 | Text |

The `up` property appears to be the most important structural relationship after folders. StudyFlow should retain and display it, and use it when recognizing Maps and related notes.

Property types are not fully consistent. The indexer should preserve original values while also storing a normalized searchable representation. It must not rewrite frontmatter.

## Tags

Tags exist, including nested subject-style tags, but they are not the vault's only or primary organizational mechanism. A preliminary text scan also encountered code preprocessor tokens and image color values that resemble tags. This means production tag extraction must:

- Parse YAML list syntax correctly.
- Ignore fenced and inline code.
- Ignore Excalidraw payloads and similar plugin data.
- Preserve nested tags such as `parent/child`.
- Preserve display spelling while indexing a normalized form.

Folder, `up`, `type`, and Maps relationships should be treated as equally important discovery mechanisms.

## Links, Maps, and backlinks

The vault is link-heavy: 415 notes contain links and at least 2,534 wikilinks were observed. A preliminary filename-based resolver matched only a portion of these links. The remaining set must not immediately be classified as broken because it may contain:

- Attachment embeds.
- Aliased links.
- Heading and block references.
- Relative-path variations.
- Dataview-generated relationships.
- Links resolved by Obsidian's shortest-path matching.
- Genuine unresolved links.

The production resolver needs Obsidian-aware normalization and must distinguish note links, attachment embeds, headings, blocks, external URLs, and unresolved references. Backlinks should be derived from the resolved link table rather than written into note files.

Maps should be recognized through a combination of their folder, the `up` hierarchy, link density, and template/property conventions. Filename heuristics alone are insufficient.

## Templates and plugin conventions

Eight notes are located in the Templates area. They should be indexed as templates and excluded from ordinary study-note results by default, while remaining discoverable through a filter.

Observed content conventions include:

- Dataview code blocks and inline expressions.
- Excalidraw frontmatter and drawing-related notes.
- Obsidian callouts.
- Embedded images.

StudyFlow should never execute Dataview, Excalidraw scripts, embedded HTML, or code from notes. The preview should show a safe fallback for unsupported dynamic blocks.

## Existing study workflow

The vault is organized primarily as a knowledge base, not as a task manager:

- Common StudyFlow-style properties such as `subject`, `priority`, `review`, and `deadline` are largely absent.
- Task checkboxes were not a meaningful general convention in the aggregate scan.
- Academic material is organized through term folders, topic folders, Maps, links, and `up` relationships.
- Date-oriented properties such as `encountered`, `date`, and `created` describe notes but should not be interpreted automatically as StudyFlow deadlines or review dates.

This supports keeping StudyFlow task state separate from Obsidian note metadata.

## Proposed StudyFlow features

The smallest useful integration is:

1. A manually refreshed, read-only metadata index.
2. A Notes workspace with folder, Map, tag, property, and text filtering.
3. Safe on-demand Markdown preview.
4. Outgoing links, backlinks, unresolved links, and related Maps.
5. Many-to-many links between StudyFlow tasks and indexed notes.
6. An Open in Obsidian action.
7. Optional subject mappings based on folders, Maps, or tags.
8. Clear unavailable, moved, duplicate-title, and malformed-note states.

The first release should not implement note editing, filesystem watching, study journals, spaced repetition, AI features, or automatic task creation from note metadata.

## Metadata inconsistencies and edge cases

- At least one duplicate filename-title group exists, so titles cannot be identifiers.
- Property values use multiple shapes and types.
- Apparent tags can occur inside source code or drawing data.
- Link resolution cannot rely only on basenames.
- Templates and Excalidraw notes require special display handling.
- The asset count requires lazy access rather than eager loading.
- The vault is stored on a Windows-mounted path, where scanning many small files from WSL may be slower than native Linux storage.

## Recommended identity and refresh strategy

- Use an internal database ID for each indexed note.
- Treat normalized relative path as the primary current location, never the title.
- Store size, modification time, and a content fingerprint for change and probable-rename detection.
- Preserve associations during an unambiguous move or rename.
- Require confirmation when duplicate content makes rename matching ambiguous.
- Parse only new or changed files during refresh.
- Keep the previous valid index if a refresh is interrupted.
- Mark missing notes unavailable before removing cached metadata.
- Never delete a task-note association merely because the vault is temporarily unavailable.

## Privacy and operational considerations

- Store the vault root only in the Git-ignored local environment.
- Store relative paths in the database; do not return absolute paths to the frontend.
- Do not store complete Markdown content in SQLite.
- Read preview content only on demand.
- Exclude vault content, generated indexes, and cached previews from Git.
- Validate canonical paths and reject traversal and symlink escapes.
- Restrict attachment serving to an explicit allowlist.
- Keep refresh user-initiated for the initial release.
- A filesystem-level boundary, such as a container that mounts only the authorized backup vault read-only, would provide stronger protection than application checks alone.

## Architecture consequence

The integration should extend StudyFlow rather than replace it. Obsidian remains the source of truth for knowledge content; StudyFlow remains the source of truth for tasks, schedules, completion history, and future review history.
