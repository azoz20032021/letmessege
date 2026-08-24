import { create } from 'zustand';

import { authApi, tokenStore, ApiClientError } from '@/lib/api';
import { connectSocket, disconnectSocket } from '@/lib/socket';
import i18n from '@/i18n';
import type { LocaleCode, User } from '@/types';

interface AuthState {
  user: User | null;
  status: 'idle' | 'loading' | 'authenticated' | 'anonymous';
  error: string | null;

  bootstrap: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  loginAsDemo: () => Promise<void>;
  logout: () => Promise<void>;
  patchUser: (patch: Partial<User>) => void;
}

/** Adopts the account's saved language unless the visitor already picked one. */
function syncLanguage(user: User) {
  const explicit = localStorage.getItem('lm.lang');
  if (!explicit && user.locale && user.locale !== i18n.resolvedLanguage) {
    void i18n.changeLanguage(user.locale as LocaleCode);
  }
}

export const useAuthStore = create<AuthState>((set) => {
  const enter = (user: User, accessToken: string) => {
    tokenStore.set(accessToken);
    syncLanguage(user);
    set({ user, status: 'authenticated', error: null });
    connectSocket();
  };

  const attempt = async (run: () => Promise<{ user: User; accessToken: string }>) => {
    set({ status: 'loading', error: null });
    try {
      const { user, accessToken } = await run();
      enter(user, accessToken);
    } catch (err) {
      const message =
        err instanceof ApiClientError
          ? err.code === 'NETWORK'
            ? i18n.t('errors.network')
            : err.message
          : i18n.t('errors.generic');
      set({ status: 'anonymous', error: message });
      throw err;
    }
  };

  return {
    user: null,
    status: 'idle',
    error: null,

    async bootstrap() {
      if (!tokenStore.get()) {
        set({ status: 'anonymous' });
        return;
      }
      set({ status: 'loading' });
      try {
        const { user } = await authApi.me();
        syncLanguage(user);
        set({ user, status: 'authenticated' });
        connectSocket();
      } catch {
        tokenStore.clear();
        set({ user: null, status: 'anonymous' });
      }
    },

    login: (email, password) => attempt(() => authApi.login({ email, password })),

    register: (name, email, password) =>
      attempt(() =>
        authApi.register({ name, email, password, locale: i18n.resolvedLanguage as LocaleCode })
      ),

    loginAsDemo: () => attempt(() => authApi.demo()),

    async logout() {
      try {
        await authApi.logout();
      } catch {
        // Signing out locally must succeed even if the request does not.
      }
      tokenStore.clear();
      disconnectSocket();
      set({ user: null, status: 'anonymous', error: null });
    },

    patchUser(patch) {
      set((state) => (state.user ? { user: { ...state.user, ...patch } } : state));
    },
  };
});
