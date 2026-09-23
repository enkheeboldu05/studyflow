import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { parseNote } from './parser.js';
import { resolveInsideVault, validateVaultRoot } from './path-policy.js';

const cleanup: string[] = [];
afterEach(async () => {
  delete process.env.OBSIDIAN_VAULT_PATH;
  await Promise.all(cleanup.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe('vault path policy', () => {
  it('accepts a configured real directory and rejects traversal', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'studyflow-vault-'));
    cleanup.push(root);
    await writeFile(path.join(root, 'note.md'), '# Safe');
    process.env.OBSIDIAN_VAULT_PATH = root;
    expect(await validateVaultRoot()).toBe(await import('node:fs/promises').then((fs) => fs.realpath(root)));
    await expect(resolveInsideVault(root, '../private.md')).rejects.toThrow(/traversal/i);
  });

  it('rejects a symbolic-link escape', async () => {
    const parent = await mkdtemp(path.join(os.tmpdir(), 'studyflow-vault-'));
    cleanup.push(parent);
    const root = path.join(parent, 'vault');
    const outside = path.join(parent, 'outside');
    await mkdir(root); await mkdir(outside);
    await writeFile(path.join(outside, 'secret.md'), 'not permitted');
    await symlink(path.join(outside, 'secret.md'), path.join(root, 'escape.md'));
    await expect(resolveInsideVault(root, 'escape.md')).rejects.toThrow(/symlink escape/i);
  });
});

describe('vault Markdown parser', () => {
  it('extracts nested tags, properties, links and ignores code tags', () => {
    const parsed = parseNote('Courses/Database.md', '---\ntags:\n  - university/database\nstatus: learning\n---\n# Database\n[[Normalization]]\n\`\`\`c\n#include <stdio.h>\n\`\`\`', 100, new Date());
    expect(parsed.tags.map((tag) => tag.normalizedName)).toContain('university/database');
    expect(parsed.tags.map((tag) => tag.normalizedName)).not.toContain('include');
    expect(parsed.properties.some((property) => property.normalizedName === 'status')).toBe(true);
    expect(parsed.links[0]?.normalizedTarget).toBe('normalization');
  });

  it('reports malformed YAML without executing or rejecting the note', () => {
    const parsed = parseNote('Broken.md', '---\ntags: [broken\n---\nBody', 30, new Date());
    expect(parsed.warnings).toContain('Malformed YAML frontmatter');
    expect(parsed.body).toBe('Body');
  });

  it('keeps duplicate titles distinguishable by relative path', () => {
    const first = parseNote('One/Topic.md', '# One', 5, new Date());
    const second = parseNote('Two/Topic.md', '# Two', 5, new Date());
    expect(first.title).toBe(second.title);
    expect(first.normalizedPath).not.toBe(second.normalizedPath);
  });
});
