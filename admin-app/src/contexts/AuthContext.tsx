import { createContext, useContext, useState, type ReactNode } from 'react';
import { authApi } from '../services/api';

interface AuthState {
  token: string | null;
  username: string | null;
  isLoading: boolean;
}

interface AuthContextValue extends AuthState {
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    token:    localStorage.getItem('admin_token'),
    username: localStorage.getItem('admin_username'),
    isLoading: false,
  });

  const login = async (username: string, password: string) => {
    setState(s => ({ ...s, isLoading: true }));
    const res = await authApi.login(username, password);
    localStorage.setItem('admin_token',    res.data.token);
    localStorage.setItem('admin_username', res.data.username);
    setState({ token: res.data.token, username: res.data.username, isLoading: false });
  };

  const logout = () => {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_username');
    setState({ token: null, username: null, isLoading: false });
  };

  return (
    <AuthContext.Provider value={{ ...state, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}
