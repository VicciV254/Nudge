import api from './client.js';

export const getStatus = () => api.get('/calendar/status');
export const listCalendars = () => api.get('/calendar/calendars');
export const saveSettings = (data) => api.patch('/calendar/settings', data);
export const disconnect = () => api.post('/calendar/disconnect', {});
export const syncNow = () => api.post('/calendar/sync', {});
export const pushTask = (id) => api.post(`/calendar/tasks/${id}/push`, {});
export const resolveConflict = (id, keep) => api.post(`/calendar/tasks/${id}/resolve`, { keep });

/**
 * Start the OAuth flow.
 *
 * The connect URL must be fetched with the bearer token (it embeds a signed
 * state tied to this user), then the browser is redirected. A plain <a href>
 * cannot carry the Authorization header, which is why this is two steps.
 */
export async function beginConnect() {
  const { url } = await api.get('/calendar/connect');
  window.location.assign(url);
}
