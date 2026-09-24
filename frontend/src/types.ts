export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'COMPLETED';
export type Priority = 'LOW' | 'MEDIUM' | 'HIGH';
export type Recurrence = 'NONE' | 'DAILY' | 'WEEKDAYS' | 'WEEKLY' | 'MONTHLY';
export type PageName = 'today' | 'week' | 'calendar' | 'inbox' | 'notes' | 'progress' | 'settings';
export type AppTheme = 'LIGHT' | 'DARK' | 'SYSTEM' | 'AUBERGINE';

export interface UserSettings {
  theme: 'LIGHT' | 'DARK' | 'SYSTEM';
  weekStartsOn: number;
  defaultPage: PageName;
  showCompleted: boolean;
  morningCheckIn: boolean;
  automaticBackup: boolean;
  lastCheckInAt?: string | null;
}

export interface User {
  id: number;
  username: string;
  email: string;
  settings?: UserSettings;
}

export interface Subject {
  id: number;
  name: string;
  description?: string | null;
  color: string;
  archivedAt?: string | null;
  _count?: { tasks: number };
}

export interface StudyTask {
  id: number;
  title: string;
  description?: string | null;
  subjectId?: number | null;
  subject?: Subject | null;
  status: TaskStatus;
  priority: Priority;
  scheduledDate?: string | null;
  dueDate?: string | null;
  estimatedMinutes?: number | null;
  important: boolean;
  recurrence: Recurrence;
  position: number;
  rescheduleCount: number;
  completedAt?: string | null;
  archivedAt?: string | null;
  createdAt: string;
}

export interface TaskInput {
  title: string;
  description?: string | null;
  subjectId?: number | null;
  status?: TaskStatus;
  priority?: Priority;
  scheduledDate?: string | null;
  dueDate?: string | null;
  estimatedMinutes?: number | null;
  important?: boolean;
  recurrence?: Recurrence;
  position?: number;
}

export interface VaultTag {
  id: number;
  normalizedName: string;
  displayName: string;
  _count?: { notes: number };
}

export interface VaultNote {
  id: number;
  title: string;
  relativePath: string;
  folder: string;
  modifiedAt: string;
  available: boolean;
  isMap: boolean;
  isTemplate: boolean;
  metadataJson?: string;
  tags: Array<{ tag: VaultTag }>;
  _count?: { outgoingLinks: number; incomingLinks: number; taskLinks: number };
}

export interface VaultNoteDetail extends VaultNote {
  vault: { name: string };
  properties: Array<{ id: number; name: string; value: string; valueType: string }>;
  outgoingLinks: Array<{
    id: number; rawTarget: string; resolved: boolean; embedded: boolean;
    targetNote?: Pick<VaultNote, 'id' | 'title' | 'relativePath' | 'available'> | null;
    targetAttachment?: { id: number; relativePath: string; mimeType: string; available: boolean } | null;
  }>;
  incomingLinks: Array<{ id: number; sourceNote: Pick<VaultNote, 'id' | 'title' | 'relativePath' | 'available'> }>;
  taskLinks: Array<{ task: Pick<StudyTask, 'id' | 'title' | 'status' | 'scheduledDate'> }>;
}

export interface VaultStatus {
  configured: boolean;
  available: boolean;
  connection?: {
    id: number;
    name: string;
    status: string;
    lastIndexedAt?: string | null;
    lastError?: string | null;
    _count: { notes: number; attachments: number; tags: number };
  } | null;
}

export interface LinkedVaultNote extends VaultNote {
  vault?: { name: string };
}
