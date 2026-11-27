export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'https://gold-trading-bot-1-15n5.onrender.com').replace(/\/$/, '');
const ACCESS_KEY = 'gold-mobile-access-token';
const REFRESH_KEY = 'gold-mobile-refresh-token';
let refreshPromise: Promise<boolean> | null = null;

export function getAccessToken() { return sessionStorage.getItem(ACCESS_KEY); }
export function getRefreshToken() { return sessionStorage.getItem(REFRESH_KEY); }
export function saveTokens(access: string, refresh?: string) {
  sessionStorage.setItem(ACCESS_KEY, access);
  if (refresh) sessionStorage.setItem(REFRESH_KEY, refresh);
}
export function clearTokens() { sessionStorage.removeItem(ACCESS_KEY); sessionStorage.removeItem(REFRESH_KEY); }

async function raw(path: string, method: string, body?: unknown, token?: string | null) {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${API_BASE_URL}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), credentials: 'omit' });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = typeof data?.error === 'string' ? data.error.replaceAll('_', ' ') : `Server error (${response.status})`;
    throw new Error(error);
  }
  return data;
}

async function refreshAccess(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;
  const refresh = getRefreshToken();
  if (!refresh) return false;
  refreshPromise = (async () => {
    try {
      const data = await raw('/api/auth/refresh', 'POST', undefined, refresh);
      if (!data.access_token) return false;
      saveTokens(data.access_token);
      return true;
    } catch { clearTokens(); return false; }
    finally { refreshPromise = null; }
  })();
  return refreshPromise;
}

export async function api<T = any>(path: string, method = 'GET', body?: unknown, auth = true): Promise<T> {
  let token = auth ? getAccessToken() : null;
  try { return await raw(path, method, body, token) as T; }
  catch (error) {
    if (auth && (error instanceof Error) && /unauthorized|token|expired|invalid.*signature/i.test(error.message) && await refreshAccess()) {
      token = getAccessToken();
      return await raw(path, method, body, token) as T;
    }
    throw error;
  }
}

export async function restoreSession() {
  if (getAccessToken()) return true;
  return refreshAccess();
}

export async function logout() {
  const refresh = getRefreshToken();
  try { if (getAccessToken()) await api('/api/auth/logout', 'POST', { refresh_token: refresh || '' }); }
  finally { clearTokens(); }
}
