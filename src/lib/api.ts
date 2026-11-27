const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ||
  'https://gold-trading-bot-1-15n5.onrender.com'
).replace(/\/+$/, '');

const ACCESS_KEY = 'gold_mobile_access_token';
const REFRESH_KEY = 'gold_mobile_refresh_token';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

let refreshInProgress: Promise<boolean> | null = null;

export function getApiBaseUrl(): string {
  return API_BASE_URL;
}

export function saveTokens(
  accessToken: string,
  refreshToken?: string
): void {
  if (!accessToken) {
    throw new Error('The server did not return an access token.');
  }

  sessionStorage.setItem(ACCESS_KEY, accessToken);

  if (refreshToken) {
    sessionStorage.setItem(REFRESH_KEY, refreshToken);
  }
}

function getAccessToken(): string | null {
  return sessionStorage.getItem(ACCESS_KEY);
}

function clearTokens(): void {
  sessionStorage.removeItem(ACCESS_KEY);
  sessionStorage.removeItem(REFRESH_KEY);
}

async function refreshAccessToken(): Promise<boolean> {
  const refreshToken = sessionStorage.getItem(REFRESH_KEY);

  if (!refreshToken) {
    clearTokens();
    return false;
  }

  if (refreshInProgress) {
    return refreshInProgress;
  }

  refreshInProgress = (async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${refreshToken}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.access_token) {
        clearTokens();
        return false;
      }

      saveTokens(data.access_token, data.refresh_token || refreshToken);
      return true;
    } catch {
      return false;
    } finally {
      refreshInProgress = null;
    }
  })();

  return refreshInProgress;
}

async function request<T>(
  path: string,
  method: HttpMethod,
  body?: unknown,
  requiresAuth = true,
  retry = true
): Promise<T> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  const token = getAccessToken();

  if (requiresAuth && token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new Error(
      'Cannot reach the trading server. Check your internet connection and try again.'
    );
  }

  if (response.status === 401 && requiresAuth && retry) {
    const refreshed = await refreshAccessToken();

    if (refreshed) {
      return request<T>(path, method, body, requiresAuth, false);
    }

    clearTokens();
    throw new Error('Your session has expired. Please sign in again.');
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
      data.message ||
      data.error ||
      data.detail ||
      `Request failed (${response.status}).`;

    throw new Error(message);
  }

  return data as T;
}

export function api<T>(
  path: string,
  method: HttpMethod = 'GET',
  body?: unknown,
  requiresAuth = true
): Promise<T> {
  return request<T>(path, method, body, requiresAuth);
}

export async function restoreSession(): Promise<boolean> {
  if (!getAccessToken() && !sessionStorage.getItem(REFRESH_KEY)) {
    return false;
  }

  try {
    await api('/api/licences/status', 'GET');
    return true;
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.toLowerCase().includes('session has expired')
    ) {
      return false;
    }

    return false;
  }
}

export async function logout(): Promise<void> {
  const accessToken = getAccessToken();
  const refreshToken = sessionStorage.getItem(REFRESH_KEY);

  try {
    if (accessToken) {
      await fetch(`${API_BASE_URL}/api/auth/logout`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
    }

    if (refreshToken) {
      await fetch(`${API_BASE_URL}/api/auth/logout-refresh`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${refreshToken}`,
        },
      });
    }
  } finally {
    clearTokens();
  }
}
