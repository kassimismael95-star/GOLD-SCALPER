
export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string };

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
}

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ||
  'https://gold-trading-bot-1-15n5.onrender.com'
).replace(/\/+$/, '');

const REQUEST_TIMEOUT_MS = 20000;
const ACCESS_TOKEN_KEY = 'gold_mobile_access_token';
const REFRESH_TOKEN_KEY = 'gold_mobile_refresh_token';

const activeControllers = new Set<AbortController>();

export function getAccessToken(): string | null {
  return window.localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  return window.localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setAuthTokens(tokens: AuthTokens): void {
  window.localStorage.setItem(ACCESS_TOKEN_KEY, tokens.access_token);
  window.localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refresh_token);
}

export function clearAuthTokens(): void {
  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  window.localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export function abortAllRequests(): void {
  for (const controller of activeControllers) {
    try {
      controller.abort();
    } catch {
      // The request may already have finished.
    }
  }

  activeControllers.clear();
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
      typeof payload.access_token !== 'string'
    ) {
      clearAuthTokens();
      return false;
    }

    window.localStorage.setItem(ACCESS_TOKEN_KEY, payload.access_token);
    return true;
  } catch {
    return false;
  }
}

function readErrorMessage(payload: unknown, status: number): string {
  if (
    typeof payload === 'object' &&
    payload !== null &&
    'error' in payload &&
    typeof payload.error === 'string'
  ) {
    return payload.error.replaceAll('_', ' ');
  }

  if (status === 401) {
    return 'Your session has expired. Please sign in again.';
  }

  if (status === 403) {
    return 'You are not authorized to perform this action.';
  }

  if (status >= 500) {
    return 'The server is temporarily unavailable. Please try again.';
  }

  return `The server returned an error (${status}).`;
}

async function request<T>(
  method: 'GET' | 'POST',
  path: string,
  isExpected: (value: unknown) => value is T,
  body?: unknown
): Promise<ApiResult<T>> {
  const controller = new AbortController();
  activeControllers.add(controller);

  const timeout = window.setTimeout(
    () => controller.abort(),
    REQUEST_TIMEOUT_MS
  );

  const url = `${API_BASE_URL}${path}`;

  const headers: Record<string, string> = {
    Accept: 'application/json',
  };

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  const sendRequest = async (): Promise<Response> => {
    const accessToken = getAccessToken();

    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    } else {
      delete headers.Authorization;
    }

    return fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
  };

  try {
    let response = await sendRequest();

    if (
      response.status === 401 &&
      path !== '/api/auth/login' &&
      path !== '/api/auth/register' &&
      path !== '/api/auth/refresh' &&
      getRefreshToken()
    ) {
      const refreshed = await refreshAccessToken();

      if (refreshed) {
        response = await sendRequest();
      }
    }

    const payload: unknown = await response.json().catch(() => null);

    if (!response.ok) {
      return {
        ok: false,
        message: readErrorMessage(payload, response.status),
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
