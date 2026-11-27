
const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ||
  'https://gold-trading-bot-1-15n5.onrender.com'
).replace(/\/+$/, '');

const ACCESS_TOKEN_KEY = 'gold_mobile_access_token';
const REFRESH_TOKEN_KEY = 'gold_mobile_refresh_token';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

type ApiError = Error & {
  status?: number;
  data?: unknown;
};

function getAccessToken(): string | null {
  return sessionStorage.getItem(ACCESS_TOKEN_KEY);
}

function getRefreshToken(): string | null {
  return sessionStorage.getItem(REFRESH_TOKEN_KEY);
}

export function saveTokens(
  accessToken: string,
  refreshToken?: string | null
): void {
  if (!accessToken) {
    throw new Error('The server did not provide an access token.');
  }

  sessionStorage.setItem(ACCESS_TOKEN_KEY, accessToken);

  if (refreshToken) {
    sessionStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  }
}

function clearTokens(): void {
  sessionStorage.removeItem(ACCESS_TOKEN_KEY);
  sessionStorage.removeItem(REFRESH_TOKEN_KEY);
}

async function readResponse(response: Response): Promise<any> {
  const text = await response.text();

  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

function makeError(
  message: string,
  status?: number,
  data?: unknown
): ApiError {
  const error = new Error(message) as ApiError;
  error.status = status;
  error.data = data;
  return error;
}

async function rawRequest<T>(
  path: string,
  method: HttpMethod,
  body?: unknown,
  token?: string | null
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: {
        Accept: 'application/json',
        ...(body !== undefined
          ? { 'Content-Type': 'application/json' }
          : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      cache: 'no-store'
    });
  } catch {
    throw makeError(
      'Cannot reach the trading server. Check your internet connection or try again later.'
    );
  }

  const data = await readResponse(response);

  if (!response.ok) {
    const message =
      data?.message ||
      data?.error ||
      data?.detail ||
      `Server request failed (${response.status}).`;

    throw makeError(message, response.status, data);
  }

  return data as T;
}

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = getRefreshToken();

  if (!refreshToken) {
    clearTokens();
    return null;
  }

  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const data = await rawRequest<any>(
        '/api/auth/refresh',
        'POST',
        undefined,
        refreshToken
      );

      if (!data?.access_token) {
        clearTokens();
        return null;
      }

      saveTokens(data.access_token, data.refresh_token || refreshToken);

      return data.access_token;
    } catch {
      clearTokens();
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export async function restoreSession(): Promise<boolean> {
  const accessToken = getAccessToken();

  if (accessToken) {
    try {
      await rawRequest(
        '/api/licences/status',
        'GET',
        undefined,
        accessToken
      );

      return true;
    } catch (error) {
      const status = (error as ApiError).status;

      if (status !== 401) {
        // A temporary server error does not prove the session is invalid.
        return true;
      }
    }
  }

  const refreshedToken = await refreshAccessToken();

  if (!refreshedToken) {
    clearTokens();
    return false;
  }

  try {
    await rawRequest(
      '/api/licences/status',
      'GET',
      undefined,
      refreshedToken
    );

    return true;
  } catch (error) {
    if ((error as ApiError).status === 401) {
      clearTokens();
      return false;
    }

    return true;
  }
}

export async function api<T = any>(
  path: string,
  method: HttpMethod = 'GET',
  body?: unknown,
  requiresAuth = true
): Promise<T> {
  if (!requiresAuth) {
    return rawRequest<T>(path, method, body);
  }

  let token = getAccessToken();

  if (!token) {
    token = await refreshAccessToken();
  }

  if (!token) {
    clearTokens();
    throw makeError('Your session has expired. Please sign in again.', 401);
  }

  try {
    return await rawRequest<T>(path, method, body, token);
  } catch (error) {
    const status = (error as ApiError).status;

    if (status !== 401) {
      throw error;
    }

    const newToken = await refreshAccessToken();

    if (!newToken) {
      clearTokens();
      throw makeError('Your session has expired. Please sign in again.', 401);
    }

    return rawRequest<T>(path, method, body, newToken);
  }
}

export async function logout(): Promise<void> {
  const accessToken = getAccessToken();
  const refreshToken = getRefreshToken();

  try {
    if (accessToken) {
      await rawRequest(
        '/api/auth/logout',
        'POST',
        {},
        accessToken
      );
    }
  } catch {
    // Always clear the local session, even if the server is unreachable.
  }

  try {
    if (refreshToken) {
      await rawRequest(
        '/api/auth/logout-refresh',
        'POST',
        {},
        refreshToken
      );
    }
  } catch {
    // The local session is still cleared below.
  }

  clearTokens();
}

export function getApiBaseUrl(): string {
  return API_BASE_URL;
}
