import { promises as fs } from 'node:fs';
import path from 'node:path';

export const allowedAttachmentTypes: Record<string, string> = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.webp': 'image/webp', '.pdf': 'application/pdf',
};

export function configuredVaultPath() {
  const configured = process.env.OBSIDIAN_VAULT_PATH?.trim();
  if (!configured) throw new Error('No Obsidian vault is configured.');
  return path.resolve(configured);
}

export async function validateVaultRoot() {
  const configured = configuredVaultPath();
  const rootInfo = await fs.lstat(configured);
  if (rootInfo.isSymbolicLink() || !rootInfo.isDirectory()) throw new Error('The configured vault must be a real directory.');
  return fs.realpath(configured);
}

export function normalizeRelative(relativePath: string) {
  return relativePath.split(path.sep).join('/').normalize('NFC');
}

export async function resolveInsideVault(root: string, relativePath: string) {
  if (!relativePath || path.isAbsolute(relativePath) || relativePath.includes('\0')) throw new Error('Invalid vault path.');
  const lexical = path.resolve(root, relativePath);
  if (lexical !== root && !lexical.startsWith(root + path.sep)) throw new Error('Vault path traversal was rejected.');
  const real = await fs.realpath(lexical);
  if (real !== root && !real.startsWith(root + path.sep)) throw new Error('A vault symlink escape was rejected.');
  const info = await fs.lstat(lexical);
  if (info.isSymbolicLink()) throw new Error('Symbolic links are not permitted.');
  return real;
}
