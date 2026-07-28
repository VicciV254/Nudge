export const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v || '').trim());

export function passwordIssue(v) {
  const s = String(v || '');
  if (s.length < 8) return 'Use at least 8 characters';
  if (!/[a-z]/.test(s) || !/[A-Z]/.test(s)) return 'Mix upper and lower case';
  if (!/\d/.test(s)) return 'Include a number';
  return null;
}

export function taskIssues({ title, dueDate }) {
  const errors = {};
  if (!String(title || '').trim()) errors.title = 'Give the task a name';
  else if (title.length > 200) errors.title = 'Keep it under 200 characters';
  if (dueDate && Number.isNaN(new Date(dueDate).getTime())) errors.dueDate = 'That date looks wrong';
  return errors;
}
