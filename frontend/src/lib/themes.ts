import type { AppTheme } from '../types';

export const themes: Array<{ id: AppTheme; name: string; description: string; colors: string[] }> = [
  { id: 'LIGHT', name: 'Light', description: 'Clean blue & white', colors: ['#f6f8fb', '#ffffff', '#344b71'] },
  { id: 'DARK', name: 'Dark navy', description: 'Cool midnight blue', colors: ['#111722', '#202b3d', '#9db5dc'] },
  { id: 'AUBERGINE', name: 'Aubergine', description: 'Plum & lavender', colors: ['#121016', '#291d3b', '#a18ae4'] },
  { id: 'SAGE', name: 'Sage', description: 'Soft green & ivory', colors: ['#f1f5ee', '#ffffff', '#386046'] },
  { id: 'PARCHMENT', name: 'Parchment', description: 'Warm cream & walnut', colors: ['#f7f1e6', '#fffcf5', '#785132'] },
  { id: 'ROSE', name: 'Rose', description: 'Blush & mulberry', colors: ['#faf1f3', '#fffafb', '#93455f'] },
  { id: 'OCEAN', name: 'Deep Ocean', description: 'Dark teal & seafoam', colors: ['#0c1c23', '#19343d', '#7cd7c5'] },
  { id: 'SYSTEM', name: 'System', description: 'Follow your device', colors: ['#f6f8fb', '#111722', '#9db5dc'] },
];

export function isCustomTheme(value: string | null): value is Exclude<AppTheme, 'LIGHT' | 'DARK' | 'SYSTEM'> {
  return themes.some(({ id }) => id === value && !['LIGHT', 'DARK', 'SYSTEM'].includes(id));
}
