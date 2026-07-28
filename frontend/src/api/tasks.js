import api from './client.js';

const qs = (params) => {
  const s = new URLSearchParams();
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '' && v !== 'all') s.set(k, v);
  });
  const out = s.toString();
  return out ? `?${out}` : '';
};

export const listTasks = (params) => api.get(`/tasks${qs(params)}`);
export const getTask = (id) => api.get(`/tasks/${id}`);
export const createTask = (data) => api.post('/tasks', data);
export const updateTask = (id, data) => api.patch(`/tasks/${id}`, data);
// scope: 'this' | 'future' | 'all' — only meaningful for recurring series.
export const deleteTask = (id, scope) =>
  api.del(`/tasks/${id}${scope && scope !== 'this' ? `?scope=${scope}` : ''}`);
export const toggleTask = (id, completed) => api.patch(`/tasks/${id}`, { completed });
export const getStats = () => api.get('/tasks/stats');
