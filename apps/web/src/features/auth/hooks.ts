import { useMutation } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { bootstrapSession } from '../../lib/api-client';
import { useAuthStore } from '../../stores/auth-store';
import { getMe } from '../users/api';
import { login, logout, verify2fa } from './api';

async function establishSession(accessToken: string): Promise<void> {
  useAuthStore.getState().setAccessToken(accessToken);
  const profile = await getMe();
  useAuthStore.getState().setProfile(profile);
}

export function useLogin() {
  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) => login(email, password),
    onSuccess: async (result) => {
      if (result.status === 'success') {
        await establishSession(result.accessToken);
      }
    },
  });
}

export function useVerify2fa() {
  return useMutation({
    mutationFn: ({ challengeToken, code }: { challengeToken: string; code: string }) => verify2fa(challengeToken, code),
    onSuccess: (result) => establishSession(result.accessToken),
  });
}

export function useLogout() {
  const clear = useAuthStore((s) => s.clear);
  return useMutation({
    mutationFn: logout,
    onSettled: () => clear(),
  });
}

/**
 * Runs once on app mount: tries to silently restore a session from the
 * httpOnly refresh cookie (so a hard refresh doesn't bounce an
 * already-logged-in user to /login), then fetches their profile.
 * Returns whether that attempt is still in flight, so the route guard
 * can hold off rendering until it knows either way.
 */
export function useSessionBootstrap(): boolean {
  const [loading, setLoading] = useState(true);
  const setAccessToken = useAuthStore((s) => s.setAccessToken);
  const setProfile = useAuthStore((s) => s.setProfile);
  const clear = useAuthStore((s) => s.clear);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = await bootstrapSession();
      if (cancelled) return;
      if (!token) {
        clear();
        setLoading(false);
        return;
      }
      setAccessToken(token);
      try {
        const profile = await getMe();
        if (!cancelled) setProfile(profile);
      } catch {
        // Session cookie was valid enough for a token refresh but /users/me
        // still failed (e.g. the account was deactivated mid-session) —
        // treat that as logged out rather than showing a half-populated shell.
        if (!cancelled) clear();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return loading;
}
