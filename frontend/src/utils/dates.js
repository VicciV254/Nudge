import {
  format, isToday, isTomorrow, isYesterday, isPast, differenceInCalendarDays,
} from 'date-fns';

/** Human-friendly due label. "Overdue 2d" beats a bare date for a to-do app. */
export function formatDue(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';

  const hasTime = d.getHours() !== 0 || d.getMinutes() !== 0;
  const time = hasTime ? format(d, 'HH:mm') : '';

  if (isToday(d)) return time ? `Today ${time}` : 'Today';
  if (isTomorrow(d)) return time ? `Tomorrow ${time}` : 'Tomorrow';
  if (isYesterday(d)) return 'Yesterday';

  const days = differenceInCalendarDays(new Date(), d);
  if (days > 0) return `Overdue ${days}d`;
  if (days > -7) return format(d, 'EEEE');
  return format(d, 'd MMM');
}

/**
 * Which colour a due date should use.
 * Only ever applied to the metadata line — never the whole row.
 */
export function dueTone(value, completed) {
  if (!value || completed) return 'muted';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'muted';
  if (isToday(d)) return 'today';
  if (isPast(d)) return 'overdue';
  return 'muted';
}

export function toInputValue(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
};
