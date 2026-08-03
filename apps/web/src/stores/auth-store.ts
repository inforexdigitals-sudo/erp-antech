import { create } from 'zustand';
import { decodeAccessToken } from '../lib/jwt';

export interface CurrentUserProfile {
  id: string;
  fullName: string;
  email: string;
  jobTitle: string | null;
  avatarUrl: string | null;
  roles: string[];
}

interface AuthState {
  /** In memory only — never localStorage/sessionStorage, so an XSS payload can't read it off disk. Lost on a hard refresh; the API client's silent-refresh flow (via the httpOnly cookie) re-establishes it. */
  accessToken: string | null;
  companyId: string | null;
  permissions: string[];
  profile: CurrentUserProfile | null;
  /** 'unknown' until the first refresh/login attempt resolves — lets the route guard show a loading state instead of flashing the login page on a hard refresh. */
  status: 'unknown' | 'authenticated' | 'unauthenticated';
  setAccessToken: (token: string) => void;
  setProfile: (profile: CurrentUserProfile) => void;
  clear: () => void;
  hasPermission: (permission: string) => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  accessToken: null,
  companyId: null,
  permissions: [],
  profile: null,
  status: 'unknown',

  setAccessToken: (token) => {
    const claims = decodeAccessToken(token);
    set({
      accessToken: token,
      companyId: claims?.companyId ?? null,
      permissions: claims?.permissions ?? [],
      status: 'authenticated',
    });
  },

  setProfile: (profile) => set({ profile }),

  clear: () => set({ accessToken: null, companyId: null, permissions: [], profile: null, status: 'unauthenticated' }),

  hasPermission: (permission) => get().permissions.includes(permission),
}));
