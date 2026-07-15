import { useAuth } from '../context/AuthContext';

export default function DashboardHome() {
  const { user } = useAuth();
  return (
    <div>
      <h2>Panel principal</h2>
      <p style={{ color: 'var(--text-secondary)', marginTop: '1rem' }}>
        Bienvenido al sistema de tickets DGCatra.
      </p>
      <div className="card" style={{ marginTop: '1.5rem', padding: '1.5rem' }}>
        <p>Tu usuario: <strong>{user?.telefono}</strong></p>
        {user?.esAdmin && <p style={{ color: 'var(--accent)' }}>🔑 Acceso de administrador</p>}
      </div>
    </div>
  );
}
