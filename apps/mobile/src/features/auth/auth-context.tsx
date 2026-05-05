import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { UserProfile } from '@app-bus/types';
import { apiClient, onUnauthenticated, tokenStore } from '@/shared/api';

interface AuthState {
  user: UserProfile | null;
  loading: boolean;
}

interface AuthContextValue extends AuthState {
  setUser: (u: UserProfile | null) => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, loading: true });

  useEffect(() => {
    let active = true;
    (async () => {
      const tokens = await tokenStore.get();
      if (!tokens) {
        if (active) setState({ user: null, loading: false });
        return;
      }
      try {
        const user = await apiClient.getProfile();
        if (active) setState({ user, loading: false });
      } catch {
        await tokenStore.clear();
        if (active) setState({ user: null, loading: false });
      }
    })();

    const off = onUnauthenticated(() => {
      if (active) setState({ user: null, loading: false });
    });
    return () => {
      active = false;
      off();
    };
  }, []);

  const value: AuthContextValue = {
    ...state,
    setUser: (user) => setState((s) => ({ ...s, user })),
    signOut: async () => {
      await apiClient.logout();
      setState({ user: null, loading: false });
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
