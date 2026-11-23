import api from './client.js';

export const getStatus = () => api.get('/calendar/status');
export const listCalendars = () => api.get('/calendar/calendars');
export const saveSettings = (data) => api.patch('/calendar/settings', data);
export const disconnect = () => api.post('/calendar/disconnect', {});
export const syncNow = () => api.post('/calendar/sync', {});
export const pushTask = (id) => api.post(`/calendar/tasks/${id}/push`, {});
export const resolveConflict = (id, keep) => api.post(`/calendar/tasks/${id}/resolve`, { keep });

// Two steps because a plain <a href> can't send the bearer token the connect URL needs (its signed
// state is tied to this user): fetch the URL, then redirect.
export async function beginConnect() {
  const { url } = await api.get('/calendar/connect');
  window.location.assign(url);
}
