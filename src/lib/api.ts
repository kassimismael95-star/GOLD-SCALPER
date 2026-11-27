
export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string };

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
}

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  'https://gold-trading-bot-1-15n5.onrender.com';

const REQUEST_TIMEOUT_MS = 20000;

const ACCESS_TOKEN_KEY = 'gold_mobile_access_token';
const REFRESH_TOKEN_KEY = 'gold_mobile_refresh_token';

const activeControllers = new Set<AbortController>();

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setAuthTokens(tokens: AuthTokens): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, tokens.access_token);
  localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refresh_token);
  window.dispatchEvent(new Event('gold-auth-changed'));
}

export function clearAuthTokens(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  window.dispatchEvent(new Event('gold-auth-changed'));
}

export function abortAllRequests(): void {
  for (const controller of activeControllers) {
    controller.abort();
  }
  activeControllers.clear();
}

function readErrorMessage(payload: unknown, fallback: string): string {
  if (
    typeof payload === 'object' &&
    payload !== null &&
    'error' in payload &&
    typeof (payload as { error: unknown }).error === 'string'
  ) {
    return (payload as { error: string }).error.replaceAll('_', ' ');
  }

  return fallback;
}

async function refreshAccessToken(): Promise<boolean> {
  const refreshToken = getRefreshToken();

  if (!refreshToken) {
    clearAuthTokens();
    return false;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${refreshToken}`,
      },
    });

    if (!response.ok) {
      clearAuthTokens();
      return false;
    }

    const payload: unknown = await response.json();

    if (
      typeof payload !== 'object' ||
      payload === null ||
      !('access_token' in payload) ||
      typeof (payload as { access_token: unknown }).access_token !== 'string'
    ) {
      clearAuthTokens();
      return false;
    }

    localStorage.setItem(
      ACCESS_TOKEN_KEY,
      (payload as { access_token: string }).access_token
    );

    return true;
  } catch {
    return false;
  }
}

async function request<T>(
  method: 'GET' | 'POST' | 'PUT',
  path: string,
  isExpected: (value: unknown) => value is T,
  body?: unknown,
  retryAfterRefresh = true
): Promise<ApiResult<T>> {
  const controller = new AbortController();
  activeControllers.add(controller);

  const timeout = window.setTimeout(
    () => controller.abort(),
    REQUEST_TIMEOUT_MS
  );

  try {
    const headers: Record<string, string> = {
      Accept: 'application/json',
    };

    const token = getAccessToken();

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });

    if (response.status === 401 && retryAfterRefresh && token) {
      const refreshed = await refreshAccessToken();

      if (refreshed) {
        return await request(method, path, isExpected, body, false);
      }

      clearAuthTokens();

      return {
        ok: false,
        message: 'Your session has expired. Please sign in again.',
      };
    }

    const payload: unknown = await response.json().catch(() => null);

    if (!response.ok) {
      return {
        ok: false,
        message: readErrorMessage(
          payload,
          `The server returned an error (${response.status}).`
        ),
      };
    }

    if (!isExpected(payload)) {
      return {
        ok: false,
        message: 'The server sent a response that could not be read.',
      };
    }

    return { ok: true, data: payload };
  } catch {
    return {
      ok: false,
      message: controller.signal.aborted
        ? 'The server took too long to respond.'
        : 'Cannot reach the server. Check your internet connection and try again.',
    };
  } finally {
    window.clearTimeout(timeout);
    activeControllers.delete(controller);
  }
}

export function apiGet<T>(
  path: string,
  isExpected: (value: unknown) => value is T
): Promise<ApiResult<T>> {
  return request('GET', path, isExpected);
}

export function apiPost<T>(
  path: string,
  body: unknown,
  isExpected: (value: unknown) => value is T
): Promise<ApiResult<T>> {
  return request('POST', path, isExpected, body);
}

export function apiPut<T>(
  path: string,
  body: unknown,
  isExpected: (value: unknown) => value is T
): Promise<ApiResult<T>> {
  return request('PUT', path, isExpected, body);
}
