import { useEffect, useRef } from 'react';

const CHECK_EVERY_MS = 60 * 1000;
const NOTIFIED_PREFIX = 'nudge.reminder.sent';
const PROMPTED_KEY = 'nudge.notifications.prompted';
const INSTALLED_KEY = 'nudge.pwa.installed';
const SETTINGS_KEY = 'nudge.reminders.settings';

export const REMINDER_LEAD_OPTIONS = [5, 10, 15, 30, 60];

const DEFAULT_SETTINGS = {
  enabled: true,
  leadMinutes: 30,
};

export function getReminderSettings() {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;

  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    const lead = Number(parsed?.leadMinutes);

    return {
      enabled: parsed?.enabled !== false,
      leadMinutes: REMINDER_LEAD_OPTIONS.includes(lead) ? lead : DEFAULT_SETTINGS.leadMinutes,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function setReminderSettings(next) {
  if (typeof window === 'undefined') return;

  const safe = {
    enabled: next?.enabled !== false,
    leadMinutes: REMINDER_LEAD_OPTIONS.includes(Number(next?.leadMinutes))
      ? Number(next.leadMinutes)
      : DEFAULT_SETTINGS.leadMinutes,
  };

  localStorage.setItem(SETTINGS_KEY, JSON.stringify(safe));
}

function isInstalledMode() {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.navigator.standalone === true ||
    localStorage.getItem(INSTALLED_KEY) === '1'
  );
}

function canUseNotifications() {
  return typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator;
}

function reminderBody(task, dueDate) {
  const clock = dueDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return `${task.title} is due at ${clock}`;
}

function notifiedKey(task) {
  return `${NOTIFIED_PREFIX}:${task.id}:${task.dueDate}`;
}

function canNotifyTask(task, now, reminderWindowMs) {
  if (task.completed || !task.dueDate) return false;

  const due = new Date(task.dueDate);
  if (Number.isNaN(due.getTime())) return false;

  const delta = due.getTime() - now.getTime();
  return delta >= 0 && delta <= reminderWindowMs;
}

async function showReminder(task) {
  const due = new Date(task.dueDate);
  const title = 'Task reminder';
  const body = reminderBody(task, due);
  const url = `/app/calendar?task=${encodeURIComponent(task.id)}`;

  try {
    const registration = await navigator.serviceWorker.ready;
    await registration.showNotification(title, {
      body,
      tag: `nudge-reminder-${task.id}`,
      renotify: false,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { url, taskId: task.id },
    });
  } catch {
    // Fallback for browsers that support Notifications but not SW display.
    const n = new Notification(title, { body, tag: `nudge-reminder-${task.id}` });
    n.onclick = () => {
      window.dispatchEvent(
        new CustomEvent('nudge:open-task', {
          detail: { taskId: task.id, url },
        })
      );
      window.focus();
    };
  }
}

async function maybePromptPermission() {
  if (!canUseNotifications() || Notification.permission !== 'default') return;
  if (localStorage.getItem(PROMPTED_KEY) === '1') return;

  localStorage.setItem(PROMPTED_KEY, '1');
  try {
    await Notification.requestPermission();
  } catch {
    // Ignore; unsupported environments can reject this call.
  }
}

async function notifyDueTasks(tasks) {
  if (!canUseNotifications()) return;
  if (!isInstalledMode()) return;

  const settings = getReminderSettings();
  if (!settings.enabled) return;

  const reminderWindowMs = settings.leadMinutes * 60 * 1000;

  await maybePromptPermission();
  if (Notification.permission !== 'granted') return;

  const now = new Date();
  for (const task of tasks) {
    if (!canNotifyTask(task, now, reminderWindowMs)) continue;
    const key = notifiedKey(task);
    if (localStorage.getItem(key) === '1') continue;

    await showReminder(task);
    localStorage.setItem(key, '1');
  }
}

export function usePwaTaskReminders(tasks) {
  const tasksRef = useRef(tasks);

  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const onInstalled = () => {
      localStorage.setItem(INSTALLED_KEY, '1');
      notifyDueTasks(tasksRef.current);
    };

    const run = () => notifyDueTasks(tasksRef.current);

    run();
    const intervalId = window.setInterval(run, CHECK_EVERY_MS);

    window.addEventListener('appinstalled', onInstalled);
    document.addEventListener('visibilitychange', run);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('appinstalled', onInstalled);
      document.removeEventListener('visibilitychange', run);
    };
  }, []);
}
