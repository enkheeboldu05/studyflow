export function startOfLocalDay(value = new Date()) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

export function endOfLocalDay(value = new Date()) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate() + 1);
}

export function parseDateOnly(value: string | null | undefined) {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  // Noon UTC keeps a date-only value on the intended calendar day across
  // common time zones while still allowing Prisma to store it as DateTime.
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12));
  return Number.isNaN(date.getTime()) ? null : date;
}

export function toDateKey(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function nextRecurringDate(date: Date, recurrence: string) {
  const next = new Date(date);
  if (recurrence === 'DAILY') next.setDate(next.getDate() + 1);
  if (recurrence === 'WEEKLY') next.setDate(next.getDate() + 7);
  if (recurrence === 'MONTHLY') next.setMonth(next.getMonth() + 1);
  if (recurrence === 'WEEKDAYS') {
    do next.setDate(next.getDate() + 1);
    while (next.getDay() === 0 || next.getDay() === 6);
  }
  return next;
}
