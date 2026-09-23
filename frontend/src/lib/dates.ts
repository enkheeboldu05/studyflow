export function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function todayKey() {
  return dateKey(new Date());
}

export function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function startOfWeek(date: Date, startsOn = 1) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const difference = (start.getDay() - startsOn + 7) % 7;
  start.setDate(start.getDate() - difference);
  return start;
}

export function displayDate(value?: string | null, options: Intl.DateTimeFormatOptions = {}) {
  if (!value) return '';
  const date = new Date(value);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', ...options });
}

export function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export function durationLabel(minutes?: number | null) {
  if (!minutes) return '';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
}
