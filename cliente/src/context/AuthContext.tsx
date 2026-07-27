import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

const API = import.meta.env.VITE_API_URL || '';

interface AuthState {
  telefono: string;
  nombre: string;
  token: string;
  esAdmin: boolean;
}

interface AuthCtx {
  user: AuthState | null;
  login: (telefono: string) => Promise<void>;
  verify: (telefono: string, codigo: string) => Promise<void>;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthCtx>(null!);

function loadAuth(): AuthState | null {
  try {
    const raw = localStorage.getItem('dgcatra_auth');
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthState | null>(loadAuth);
  const [loading, setLoading] = useState(false);

  const login = useCallback(async (telefono: string) => {
    setLoading(true);
    try {
      await fetch(`${API}/api/auth/solicitar-codigo`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telefono }),
      });
    } finally { setLoading(false); }
  }, []);

  const verify = useCallback(async (telefono: string, codigo: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/auth/verificar-codigo`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telefono, codigo }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Código inválido');
      const data = await res.json();
      const session: AuthState = { telefono, token: data.token, nombre: data.nombre, esAdmin: data.esAdmin };
      localStorage.setItem('dgcatra_auth', JSON.stringify(session));
      setUser(session);
    } finally { setLoading(false); }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('dgcatra_auth');
    setUser(null);
  }, []);

  return <AuthContext.Provider value={{ user, login, verify, logout, loading }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
