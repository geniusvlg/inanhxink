import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { authApi, type AuthUser } from '../services/api';

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  ready: boolean;
}

interface AuthContextValue extends AuthState {
  username: string | null;
  isSystem: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  setUser: (user: AuthUser) => void;
  can: (key: string) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(() => {
    const token = localStorage.getItem('admin_token');
    return { token, user: null, ready: !token };
  });

  useEffect(() => {
    if (!state.token) return;
    let cancelled = false;
    authApi.me()
      .then((res) => {
        if (cancelled) return;
        localStorage.setItem('admin_username', res.data.user.username);
        setState((s) => ({ ...s, user: res.data.user, ready: true }));
      })
      .catch(() => {
        if (cancelled) return;
        localStorage.removeItem('admin_token');
        localStorage.removeItem('admin_username');
        setState({ token: null, user: null, ready: true });
      });
    return () => {
      cancelled = true;
    };
  }, [state.token]);

  const login = async (username: string, password: string) => {
    const res = await authApi.login(username, password);
    localStorage.setItem('admin_token', res.data.token);
    localStorage.setItem('admin_username', res.data.username);
    setState({ token: res.data.token, user: res.data.user, ready: true });
  };

  const logout = () => {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_username');
    setState({ token: null, user: null, ready: true });
  };

  const setUser = (user: AuthUser) => {
    setState((s) => ({ ...s, user }));
  };

  const can = (key: string) => !!state.user?.permissions.includes(key);

  return (
    <AuthContext.Provider value={{
      ...state,
      username: state.user?.username ?? localStorage.getItem('admin_username'),
      isSystem: !!state.user?.role.is_system,
      login,
      logout,
      setUser,
      can,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}
