import api, { tokens } from './client.js';

export async function login(email, password) {
  const data = await api.post('/auth/login', { email, password });
  tokens.set(data.accessToken, data.refreshToken);
  return data.user;
}

export async function register(payload) {
  const data = await api.post('/auth/register', payload);
  tokens.set(data.accessToken, data.refreshToken);
  return data.user;
}

export const me = () => api.get('/auth/me');

export async function logout() {
  try {
    await api.post('/auth/logout', {});
  } catch {
    /* best effort — clear locally regardless */
  }
  tokens.clear();
}

export const googleAuthUrl = () =>
  `${import.meta.env?.VITE_API_URL || '/api'}/auth/google`;
