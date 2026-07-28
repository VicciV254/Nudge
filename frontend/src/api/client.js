/**
 * Tiny fetch wrapper. No axios — fetch plus ~60 lines does everything this app
 * needs, and it keeps the bundle smaller.
 *
 * Handles: base URL, JSON, bearer token, one silent refresh on 401, and errors
 * that carry a usable `message` instead of "Failed to fetch".
 */

const BASE = import.meta.env?.VITE_API_URL || '/api';

const TOKEN_KEY = 'nudge-token';
const REFRESH_KEY = 'nudge-refresh';

export const tokens = {
  get: () => {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  getRefresh: () => {
    try {
      return localStorage.getItem(REFRESH_KEY);
    } catch {
      return null;
    }
  },
  set: (access, refresh) => {
    try {
      if (access) localStorage.setItem(TOKEN_KEY, access);
      if (refresh) localStorage.setItem(REFRESH_KEY, refresh);
    } catch {
      /* ignore */
    }
  },
  clear: () => {
    try {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(REFRESH_KEY);
    } catch {
      /* ignore */
    }
  },
};

export class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

let refreshing = null;

async function refreshToken() {
  // Collapse concurrent 401s into a single refresh call.
  if (refreshing) return refreshing;
  const rt = tokens.getRefresh();
  if (!rt) return Promise.resolve(null);

  refreshing = fetch(`${BASE}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: rt }),
  })
    .then((r) => (r.ok ? r.json() : null))
    .then((data) => {
      if (data?.accessToken) {
        tokens.set(data.accessToken, data.refreshToken);
        return data.accessToken;
      }
      tokens.clear();
      return null;
    })
    .catch(() => null)
    .finally(() => {
      refreshing = null;
    });

  return refreshing;
}

async function request(path, { method = 'GET', body, headers = {}, retry = true } = {}) {
  const token = tokens.get();
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 && retry && tokens.getRefresh()) {
    const fresh = await refreshToken();
    if (fresh) return request(path, { method, body, headers, retry: false });
  }

  if (res.status === 204) return null;

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    throw new ApiError(data?.error || data?.message || `Request failed (${res.status})`, res.status, data);
  }
  return data;
}

export const api = {
  get: (p) => request(p),
  post: (p, body) => request(p, { method: 'POST', body }),
  patch: (p, body) => request(p, { method: 'PATCH', body }),
  put: (p, body) => request(p, { method: 'PUT', body }),
  del: (p) => request(p, { method: 'DELETE' }),
};

export default api;
