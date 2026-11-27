
export const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ||
  'https://gold-trading-bot-1-15n5.onrender.com'
).replace(/\/+$/, '');

const ACCESS_KEY = 'gold-mobile-access-token';
const REFRESH_KEY = 'gold-mobile-refresh-token';

const REQUEST_TIMEOUT_MS = 25000;

let refreshPromise: Promise<boolean> | null = null;

export type ApiMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

function readStorage(key: string): string | null {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string): void {
  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    throw new Error('Your browser could not save the login session.');
  }
}

function removeStorage(key: string): void {
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // Storage may be unavailable.
  }
}

export function getAccessToken(): string | null {
  return readStorage(ACCESS_KEY);
}

export function getRefreshToken(): string | null {
  return readStorage(REFRESH_KEY);
}

export function saveTokens(
  accessToken: string,
  refreshToken?: string
): void {
  if (!accessToken) {
    throw new Error('The server returned an empty access token.');
  }

  writeStorage(ACCESS_KEY, accessToken);

  if (refreshToken) {
    writeStorage(REFRESH_KEY, refreshToken);
  }
}

export function clearTokens(): void {
  removeStorage(ACCESS_KEY);
  removeStorage(REFRESH_KEY);
}

interface ApiErrorPayload {
  error?: string;
  message?: string;
  detail?: string;
}

function readableError(value: unknown, status: number): string {
  if (value && typeof value === 'object') {
    const data = value as ApiErrorPayload;

    const message =
      data.error ||
      data.message ||
      data.detail;

    if (typeof message === 'string' && message.trim()) {
      return message
        .replaceAll('_', ' ')
        .replace(/^\w/, letter => letter.toUpperCase());
    }
  }

  const defaults: Record<number, string> = {
    400: 'The submitted information is invalid.',
    401: 'Your session has expired. Please sign in again.',
    403: 'You do not have permission to perform this action.',
    404: 'The requested service or feature was not found.',
    409: 'This action conflicts with your current account status.',
    429: 'Too many requests. Please wait and try again.',
    500: 'The server encountered an internal error.',
    502: 'The server gateway is temporarily unavailable.',
    503: 'The service is temporarily unavailable.',
  };

  return defaults[status] || `Server error (${status}).`;
}

async function rawRequest<T>(
  path: string,
  method: ApiMethod,
  body?: unknown,
  token?: string | null
): Promise<T> {
  const controller = new AbortController();

  const timeout = window.setTimeout(
    () => controller.abort(),
    REQUEST_TIMEOUT_MS
  );

  const headers: Record<string, string> = {
    Accept: 'application/json',
  };

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined
        ? undefined
        : JSON.stringify(body),
      credentials: 'omit',
      cache: 'no-store',
      signal: controller.signal,
    });

    const responseText = await response.text();

    let data: unknown = {};

    if (responseText) {
      try {
        data = JSON.parse(responseText);
      } catch {
        data = {
          error: responseText.slice(0, 300),
        };
      }
    }

    if (!response.ok) {
      const error = new Error(
        readableError(data, response.status)
      );

      Object.assign(error, {
        status: response.status,
        data,
      });

      throw error;
    }

    return data as T;
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new Error(
          'The server took too long to respond. Please try again.'
        );
      }

      if ('status' in error) {
        throw error;
      }

      if (
        error.message.toLowerCase().includes('failed to fetch') ||
        error.message.toLowerCase().includes('networkerror')
      ) {
        throw new Error(
          'Cannot reach the trading server. Check the internet connection and server CORS settings.'
        );
      }

      throw error;
    }

    throw new Error('An unexpected network error occurred.');
  } finally {
    window.clearTimeout(timeout);
  }
}

async function refreshAccessToken(): Promise<boolean> {
  if (refreshPromise) {
    return refreshPromise;
  }

  const refreshToken = getRefreshToken();

  if (!refreshToken) {
    return false;
  }

  refreshPromise = (async () => {
    try {
      const result = await rawRequest<{
        access_token?: string;
      }>(
        '/api/auth/refresh',
        'POST',
        undefined,
        refreshToken
      );

      if (!result.access_token) {
        clearTokens();
        return false;
      }

      saveTokens(result.access_token);

      return true;
    } catch {
      clearTokens();
      return false;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export async function api<T = any>(
  path: string,
  method: ApiMethod = 'GET',
  body?: unknown,
  requiresAuth = true
): Promise<T> {
  let token = requiresAuth
    ? getAccessToken()
    : null;

  if (requiresAuth && !token) {
    const refreshed = await refreshAccessToken();

    if (!refreshed) {
      throw new Error(
        'Your session has expired. Please sign in again.'
      );
    }

    token = getAccessToken();
  }

  try {
    return await rawRequest<T>(
      path,
      method,
      body,
      token
    );
  } catch (error) {
    const status =
      error &&
      typeof error === 'object' &&
      'status' in error
        ? Number((error as { status: number }).status)
        : 0;

    if (
      requiresAuth &&
      status === 401
    ) {
      const refreshed = await refreshAccessToken();

      if (refreshed) {
        return rawRequest<T>(
          path,
          method,
          body,
          getAccessToken()
        );
      }

      clearTokens();

      throw new Error(
        'Your session expired. Please sign in again.'
      );
    }

    throw error;
  }
}

export async function restoreSession(): Promise<boolean> {
  if (getAccessToken()) {
    return true;
  }

  return refreshAccessToken();
}

export async function logout(): Promise<void> {
  const accessToken = getAccessToken();
  const refreshToken = getRefreshToken();

  try {
    if (accessToken) {
      await rawRequest(
        '/api/auth/logout',
        'POST',
        {
          refresh_token: refreshToken || '',
        },
        accessToken
      );
    }
  } catch {
    // Always clear local credentials even if the server is offline.
  } finally {
    clearTokens();
  }
}
