
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

const ACCESS_TOKEN_KEY = 'gold_mobile_access_token';
const REFRESH_TOKEN_KEY = 'gold_mobile_refresh_token';
const REQUEST_TIMEOUT_MS = 20000;

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function saveTokens(
  accessToken: string,
  refreshToken: string
): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  window.dispatchEvent(new Event('gold-auth-changed'));
}

export function setAuthTokens(tokens: AuthTokens): void {
  saveTokens(tokens.access_token, tokens.refresh_token);
}

export function clearAuthTokens(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  window.dispatchEvent(new Event('gold-auth-changed'));
}

function getErrorMessage(
  payload: unknown,
  fallback: string
): string {
  if (
    typeof payload === 'object' &&
    payload !== null &&
    'error' in payload &&
    typeof payload.error === 'string'
  ) {
    return payload.error.replaceAll('_', ' ');
  }

  if (
    typeof payload === 'object' &&
    payload !== null &&
    'message' in payload &&
    typeof payload.message === 'string'
  ) {
    return payload.message;
  }

  return fallback;
}

async function readResponse(response: Response): Promise<unknown> {
  if (response.status === 204) {
    return {};
  }

  const text = await response.text();

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

async function refreshAccessToken(): Promise<boolean> {
  const refreshToken = getRefreshToken();

  if (!refreshToken) {
    return false;
  }

  const controller = new AbortController();
  const timeout = window.setTimeout(
    () => controller.abort(),
    REQUEST_TIMEOUT_MS
  );

  try {
    const response = await fetch(
      `${API_BASE_URL}/api/auth/refresh`,
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${refreshToken}`,
        },
        signal: controller.signal,
      }
    );

    const payload = await readResponse(response);

    if (
      !response.ok ||
      typeof payload !== 'object' ||
      payload === null ||
      !('access_token' in payload) ||
      typeof payload.access_token !== 'string'
    ) {
      clearAuthTokens();
      return false;
    }

    localStorage.setItem(
      ACCESS_TOKEN_KEY,
      payload.access_token
    );

    return true;
  } catch {
    return false;
  } finally {
    window.clearTimeout(timeout);
  }
}

/**
 * Main API function used by App.tsx.
 *
 * authenticated = false is used for public authentication
 * endpoints such as login, registration and email verification.
 */
export async function api<T = any>(
  path: string,
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' = 'GET',
  body?: unknown,
  authenticated = true,
  retryAfterRefresh = true
): Promise<T> {
  const controller = new AbortController();

  const timeout = window.setTimeout(
    () => controller.abort(),
    REQUEST_TIMEOUT_MS
  );

  try {
    const headers: Record<string, string> = {
      Accept: 'application/json',
    };

    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }

    const accessToken = getAccessToken();

    if (authenticated && accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }

    const response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });

    if (
      response.status === 401 &&
      authenticated &&
      retryAfterRefresh &&
      getRefreshToken()
    ) {
      const refreshed = await refreshAccessToken();

      if (refreshed) {
        return await api<T>(
          path,
          method,
          body,
          authenticated,
          false
        );
      }

      clearAuthTokens();

      throw new Error('Your session has expired. Please sign in again.');
    }

    const payload = await readResponse(response);

    if (!response.ok) {
      throw new Error(
        getErrorMessage(
          payload,
          `Server request failed (${response.status}).`
        )
      );
    }

    return payload as T;
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new Error('The server took too long to respond.');
      }

      throw error;
    }

    throw new Error('Cannot reach the server. Please try again.');
  } finally {
    window.clearTimeout(timeout);
  }
}

/**
 * Restores the customer's session when the app opens.
 */
export async function restoreSession(): Promise<boolean> {
  const accessToken = getAccessToken();
  const refreshToken = getRefreshToken();

  if (!accessToken && !refreshToken) {
    return false;
  }

  if (!refreshToken) {
    return Boolean(accessToken);
  }

  const refreshed = await refreshAccessToken();

  if (!refreshed) {
    clearAuthTokens();
    return false;
  }

  return true;
}

/**
 * Signs out and clears local authentication credentials.
 */
export async function logout(): Promise<void> {
  const refreshToken = getRefreshToken();

  try {
    if (getAccessToken()) {
      await api(
        '/api/auth/logout',
        'POST',
        { refresh_token: refreshToken },
        true
      );
    }
  } finally {
    clearAuthTokens();
  }
}

/**
 * Compatibility helpers for files using ApiResult.
 */
async function resultRequest<T>(
  method: 'GET' | 'POST' | 'PUT',
  path: string,
  body: unknown,
  isExpected: (value: unknown) => value is T
): Promise<ApiResult<T>> {
  try {
    const payload = await api<unknown>(
      path,
      method,
      body,
      true
    );

    if (!isExpected(payload)) {
      return {
        ok: false,
        message: 'The server returned an unexpected response.',
      };
    }

    return { ok: true, data: payload };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : 'The server request failed.',
    };
  }
}

export function apiGet<T>(
  path: string,
  isExpected: (value: unknown) => value is T
): Promise<ApiResult<T>> {
  return resultRequest('GET', path, undefined, isExpected);
}

export function apiPost<T>(
  path: string,
  body: unknown,
  isExpected: (value: unknown) => value is T
): Promise<ApiResult<T>> {
  return resultRequest('POST', path, body, isExpected);
}

export function apiPut<T>(
  path: string,
  body: unknown,
  isExpected: (value: unknown) => value is T
): Promise<ApiResult<T>> {
  return resultRequest('PUT', path, body, isExpected);
}

export function abortAllRequests(): void {
  // Kept for compatibility with existing frontend imports.
}
