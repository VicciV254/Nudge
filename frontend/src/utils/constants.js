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

// Mirrors COLOR_ID in backend/src/services/eventMapper.js, which explains the slot choices.
export const GCAL_COLOR_ID = {
  urgent: '11', // Tomato
  high: '5',    // Banana
  normal: '8',  // Graphite
  low: '9',     // Blueberry
  completed: '10', // Basil
};
