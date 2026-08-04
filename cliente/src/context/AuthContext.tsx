import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';

const API = import.meta.env.VITE_API_URL || '';
const INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minutos

interface AuthState {
  telefono: string;
  nombre: string;
  token: string;
  esAdmin: boolean;
}

interface AuthCtx {
  user: AuthState | null;
  login: (telefono: string) => Promise<string>;
  verify: (telefono: string, codigo: string) => Promise<void>;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthCtx>(null!);

function loadAuth(): AuthState | null {
  try {
    const raw = localStorage.getItem('dgcatra_auth');
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (Date.now() - data._ts > INACTIVITY_TIMEOUT) {
      localStorage.removeItem('dgcatra_auth');
      return null;
    }
    data._ts = Date.now();
    localStorage.setItem('dgcatra_auth', JSON.stringify(data));
    return data;
  } catch { return null; }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthState | null>(loadAuth);
  const [loading, setLoading] = useState(false);

  const login = useCallback(async (telefono: string): Promise<string> => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/auth/solicitar-codigo`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telefono }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al solicitar código');
      return data.message || 'Código enviado';
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
      const session: AuthState = { telefono, token: data.token, nombre: data.nombre || '', esAdmin: data.esAdmin, _ts: Date.now() } as any;
      localStorage.setItem('dgcatra_auth', JSON.stringify(session));
      setUser(session);
    } finally { setLoading(false); }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('dgcatra_auth');
    setUser(null);
  }, []);

  useEffect(() => {
    if (!user) return;
    const bumpTs = () => {
      const raw = localStorage.getItem('dgcatra_auth');
      if (raw) {
        const data = JSON.parse(raw);
        data._ts = Date.now();
        localStorage.setItem('dgcatra_auth', JSON.stringify(data));
      }
    };
    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    events.forEach(e => window.addEventListener(e, bumpTs));
    const interval = setInterval(() => {
      const raw = localStorage.getItem('dgcatra_auth');
      if (!raw) { logout(); return; }
      const data = JSON.parse(raw);
      if (Date.now() - data._ts > INACTIVITY_TIMEOUT) logout();
    }, 10000);
    return () => {
      events.forEach(e => window.removeEventListener(e, bumpTs));
      clearInterval(interval);
    };
  }, [user, logout]);

  return <AuthContext.Provider value={{ user, login, verify, logout, loading }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
