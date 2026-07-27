import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function DashboardLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() { logout(); navigate('/login', { replace: true }); }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <aside style={{ width: 220, background: '#1e293b', color: '#fff', padding: '1rem 0' }}>
        <h2 style={{ padding: '0 1rem', marginBottom: '1.5rem', fontSize: '1.1rem' }}>DG Catra</h2>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          <NavLink to="/" end style={({ isActive }) => ({
            display: 'flex', alignItems: 'center', gap: '.5rem', padding: '.6rem 1rem',
            textDecoration: 'none', color: isActive ? '#fff' : '#94a3b8',
            background: isActive ? 'rgba(255,255,255,.1)' : 'transparent',
            borderLeft: isActive ? '3px solid #3b82f6' : '3px solid transparent',
          })}>
            📊 Inicio
          </NavLink>
          <NavLink to="/tickets" style={({ isActive }) => ({
            display: 'flex', alignItems: 'center', gap: '.5rem', padding: '.6rem 1rem',
            textDecoration: 'none', color: isActive ? '#fff' : '#94a3b8',
            background: isActive ? 'rgba(255,255,255,.1)' : 'transparent',
            borderLeft: isActive ? '3px solid #3b82f6' : '3px solid transparent',
          })}>
            🎫 Tickets
          </NavLink>
        </nav>
      </aside>
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <header style={{ background: 'var(--surface)', padding: '.7rem 1.5rem', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '1rem', borderBottom: '1px solid var(--border)' }}>
          <span style={{ color: 'var(--text-secondary)', fontSize: '.9rem' }}>{user?.telefono}</span>
          {user?.esAdmin && <span className="badge badge-admin" style={{ background: '#3b82f6', color: '#fff', padding: '.15rem .5rem', borderRadius: 4, fontSize: '.75rem' }}>Admin</span>}
          <button className="btn btn-ghost btn-sm" onClick={handleLogout}>Salir</button>
        </header>
        <div style={{ padding: '1.5rem', flex: 1 }}>
          <Outlet />
        </div>
      </main>
    </div>
  );
}
