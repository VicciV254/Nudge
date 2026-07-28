export const PRIORITIES = [
  { value: 'urgent', label: 'Urgent' },
  { value: 'high',   label: 'High' },
  { value: 'normal', label: 'Normal' },
  { value: 'low',    label: 'Low' },
];

export const CATEGORIES = ['Work', 'Personal', 'Study', 'Health', 'Errands'];

export const FILTERS = [
  { value: 'all',       label: 'All',       icon: 'inbox' },
  { value: 'today',     label: 'Today',     icon: 'clock' },
  { value: 'upcoming',  label: 'Upcoming',  icon: 'calendar' },
  { value: 'overdue',   label: 'Overdue',   icon: 'alert' },
  { value: 'completed', label: 'Done',      icon: 'check' },
];

/**
 * Google Calendar's events.colorId is a fixed 11-slot palette — you cannot send
 * arbitrary hex. These slots were chosen for mutual separation (all >= dE 0.13
 * apart in OKLab) so priorities stay distinguishable inside Google's own UI.
 *
 * Note "5" (Banana) for high rather than "6" (Tangerine): Tangerine is a
 * red-orange only dE 0.07 from urgent's Tomato, effectively identical in a
 * month view. And completed is "10" (Basil, green) — "3" is Grape, i.e. purple.
 */
export const GCAL_COLOR_ID = {
  urgent: '11', // Tomato
  high: '5',    // Banana
  normal: '8',  // Graphite
  low: '9',     // Blueberry
  completed: '10', // Basil
};
