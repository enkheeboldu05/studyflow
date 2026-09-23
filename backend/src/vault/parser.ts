import crypto from 'node:crypto';
import path from 'node:path';
import { parseDocument } from 'yaml';
import { normalizeRelative } from './path-policy.js';

export interface ParsedLink {
  rawTarget: string; normalizedTarget: string; heading: string | null; blockId: string | null;
  kind: 'WIKILINK' | 'MARKDOWN'; embedded: boolean;
}
export interface ParsedProperty { name: string; normalizedName: string; value: string; valueType: string; }
export interface ParsedNote {
  relativePath: string; normalizedPath: string; title: string; folder: string; contentHash: string;
  size: number; modifiedAt: Date; metadata: Record<string, unknown>; aliases: string[];
  tags: Array<{ normalizedName: string; displayName: string }>; properties: ParsedProperty[];
  links: ParsedLink[]; isMap: boolean; isTemplate: boolean; body: string; warnings: string[];
}

const flatten = (value: unknown): unknown[] => Array.isArray(value) ? value.flatMap(flatten) : [value];
function propertyType(value: unknown) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'list';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) return 'date';
  return typeof value;
}
const cleanTag = (value: string) => value.trim().replace(/^#/, '').replace(/[.,;:!?]+$/, '');

export function parseNote(relativePath: string, content: string, size: number, modifiedAt: Date): ParsedNote {
  const warnings: string[] = [];
  let body = content;
  let metadata: Record<string, unknown> = {};
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (match) {
    const document = parseDocument(match[1], { prettyErrors: false });
    if (document.errors.length) warnings.push('Malformed YAML frontmatter');
    else {
      const parsed = document.toJS({ maxAliasCount: 50 });
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) metadata = parsed as Record<string, unknown>;
    }
    body = content.slice(match[0].length);
  } else if (content.startsWith('---')) warnings.push('Frontmatter has no closing delimiter');

  const tags = new Map<string, string>();
  for (const value of flatten(metadata.tags ?? metadata.tag ?? [])) {
    if (typeof value !== 'string') continue;
    for (const part of value.split(/[\s,]+/)) {
      const displayName = cleanTag(part);
      if (displayName) tags.set(displayName.toLocaleLowerCase(), displayName);
    }
  }
  const taggable = body.replace(/```[\s\S]*?```/g, '').replace(/`[^`]*`/g, '');
  for (const tagMatch of taggable.matchAll(/(?:^|[\s([>{])#([\p{L}\p{N}_/-]+)/gu)) {
    const displayName = cleanTag(tagMatch[1]);
    if (displayName) tags.set(displayName.toLocaleLowerCase(), displayName);
  }

  const links: ParsedLink[] = [];
  for (const link of body.matchAll(/(!?)\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g)) {
    const raw = link[2].trim();
    const [beforeBlock, blockId] = raw.split('^', 2);
    const [target, heading] = beforeBlock.split('#', 2);
    links.push({ rawTarget: raw, normalizedTarget: normalizeRelative(target.trim()).toLocaleLowerCase(), heading: heading || null, blockId: blockId || null, kind: 'WIKILINK', embedded: Boolean(link[1]) });
  }
  for (const link of body.matchAll(/(!?)\[[^\]]*\]\(([^)]+)\)/g)) {
    const target = link[2].trim().replace(/^<|>$/g, '');
    if (/^(https?:|mailto:|obsidian:|data:)/i.test(target)) continue;
    links.push({ rawTarget: target, normalizedTarget: normalizeRelative(target.split('#')[0]).toLocaleLowerCase(), heading: target.includes('#') ? target.slice(target.indexOf('#') + 1) : null, blockId: null, kind: 'MARKDOWN', embedded: Boolean(link[1]) });
  }

  const aliases = flatten(metadata.aliases ?? metadata.alias ?? []).filter((value): value is string => typeof value === 'string');
  const properties: ParsedProperty[] = [];
  for (const [name, rawValue] of Object.entries(metadata)) {
    for (const value of flatten(rawValue)) properties.push({ name, normalizedName: name.toLocaleLowerCase(), value: typeof value === 'string' ? value : JSON.stringify(value), valueType: propertyType(rawValue) });
  }

  const defaultTitle = path.posix.basename(relativePath, '.md');
  const title = typeof metadata.title === 'string' && metadata.title.trim() ? metadata.title.trim() : defaultTitle;
  const folder = path.posix.dirname(relativePath) === '.' ? '' : path.posix.dirname(relativePath);
  const linkCount = links.filter((link) => !link.embedded).length;
  const type = typeof metadata.type === 'string' ? metadata.type : '';

  return {
    relativePath, normalizedPath: normalizeRelative(relativePath).toLocaleLowerCase(), title, folder,
    contentHash: crypto.createHash('sha256').update(content).digest('hex'), size, modifiedAt, metadata, aliases,
    tags: [...tags].map(([normalizedName, displayName]) => ({ normalizedName, displayName })), properties, links,
    isMap: /(^|\/)maps?(\/|$)/i.test(relativePath) || /\b(moc|map of content)\b/i.test(type) || linkCount >= 15,
    isTemplate: /(^|\/)templates?(\/|$)/i.test(relativePath), body, warnings,
  };
}
