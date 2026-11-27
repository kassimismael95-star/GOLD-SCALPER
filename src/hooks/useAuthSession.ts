
import { useEffect, useState } from 'react';
import { getAccessToken, getRefreshToken } from '@/lib/api';

export type AuthSession = {
  access_token: string | null;
  refresh_token: string | null;
};

export type AuthState =
  | { phase: 'loading' }
  | { phase: 'ready'; session: AuthSession | null };

function readSession(): AuthSession | null {
  const accessToken = getAccessToken();
  const refreshToken = getRefreshToken();

  if (!accessToken && !refreshToken) {
    return null;
  }

  return {
    access_token: accessToken,
    refresh_token: refreshToken,
  };
}

export function useAuthSession(): AuthState {
  const [state, setState] = useState<AuthState>({
    phase: 'loading',
  });

  useEffect(() => {
    let active = true;

    const updateSession = () => {
      if (active) {
        setState({
          phase: 'ready',
          session: readSession(),
        });
      }
    };

    updateSession();

    window.addEventListener('storage', updateSession);

    window.addEventListener('gold-auth-changed', updateSession);

    return () => {
      active = false;
      window.removeEventListener('storage', updateSession);
      window.removeEventListener('gold-auth-changed', updateSession);
    };
  }, []);

  return state;
}
