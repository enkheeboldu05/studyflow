export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'COMPLETED';
export type Priority = 'LOW' | 'MEDIUM' | 'HIGH';
export type Recurrence = 'NONE' | 'DAILY' | 'WEEKDAYS' | 'WEEKLY' | 'MONTHLY';
export type PageName = 'today' | 'week' | 'calendar' | 'inbox' | 'study-log' | 'progress' | 'settings';
export type AppTheme = 'LIGHT' | 'DARK' | 'SYSTEM' | 'AUBERGINE' | 'SAGE' | 'PARCHMENT' | 'ROSE' | 'OCEAN';

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

export interface StudyLog {
  id: number;
  date: string;
  targetMinutes: number;
  actualMinutes: number;
  createdAt: string;
  updatedAt: string;
}

export interface StudyTimer {
  id: number;
  logDate: string;
  status: 'RUNNING' | 'PAUSED';
  startedAt?: string | null;
  elapsedSeconds: number;
  createdAt: string;
  updatedAt: string;
}
