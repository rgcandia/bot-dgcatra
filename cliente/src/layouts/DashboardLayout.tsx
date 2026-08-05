import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/useSocket';

export default function DashboardLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { notificacion, limpiarNotificacion } = useSocket();

  function handleLogout() { logout(); navigate('/login', { replace: true }); }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <aside style={{ width: 220, background: '#1A2C3F', color: '#fff', padding: '1rem 0', display: 'flex', flexDirection: 'column' }}>
        <h2 style={{ padding: '0 1rem', marginBottom: '1.5rem', fontSize: '1rem', fontWeight: 800, letterSpacing: 3, textAlign: 'center' }}>
          DGCATRA
        </h2>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 0, flex: 1 }}>
          <NavLink to="/" end style={({ isActive }) => ({
            display: 'flex', alignItems: 'center', gap: '.5rem', padding: '.6rem 1rem',
            textDecoration: 'none', color: isActive ? '#B6FF18' : '#A2A6AB',
            background: isActive ? 'rgba(182,255,24,.08)' : 'transparent',
            borderLeft: isActive ? '3px solid #B6FF18' : '3px solid transparent',
          })}>
            📊 Inicio
          </NavLink>
          <NavLink to="/tickets" style={({ isActive }) => ({
            display: 'flex', alignItems: 'center', gap: '.5rem', padding: '.6rem 1rem',
            textDecoration: 'none', color: isActive ? '#B6FF18' : '#A2A6AB',
            background: isActive ? 'rgba(182,255,24,.08)' : 'transparent',
            borderLeft: isActive ? '3px solid #B6FF18' : '3px solid transparent',
          })}>
            🎫 Tickets
          </NavLink>

          {user?.esAdmin && (
            <>
              <div style={{ color: '#FFD700', fontSize: '.65rem', padding: '1rem 1rem .3rem', textTransform: 'uppercase', letterSpacing: 2 }}>
                Administración
              </div>
              <NavLink to="/admin/bases" style={({ isActive }) => ({
                display: 'flex', alignItems: 'center', gap: '.5rem', padding: '.6rem 1rem',
                textDecoration: 'none', color: isActive ? '#B6FF18' : '#A2A6AB',
                background: isActive ? 'rgba(182,255,24,.08)' : 'transparent',
                borderLeft: isActive ? '3px solid #B6FF18' : '3px solid transparent',
              })}>
                🏢 Bases
              </NavLink>
              <NavLink to="/admin/sectores" style={({ isActive }) => ({
                display: 'flex', alignItems: 'center', gap: '.5rem', padding: '.6rem 1rem',
                textDecoration: 'none', color: isActive ? '#B6FF18' : '#A2A6AB',
                background: isActive ? 'rgba(182,255,24,.08)' : 'transparent',
                borderLeft: isActive ? '3px solid #B6FF18' : '3px solid transparent',
              })}>
                ⚙️ Sectores
              </NavLink>
              <NavLink to="/admin/usuarios" style={({ isActive }) => ({
                display: 'flex', alignItems: 'center', gap: '.5rem', padding: '.6rem 1rem',
                textDecoration: 'none', color: isActive ? '#B6FF18' : '#A2A6AB',
                background: isActive ? 'rgba(182,255,24,.08)' : 'transparent',
                borderLeft: isActive ? '3px solid #B6FF18' : '3px solid transparent',
              })}>
                👥 Usuarios
              </NavLink>
              <NavLink to="/admin/settings" style={({ isActive }) => ({
                display: 'flex', alignItems: 'center', gap: '.5rem', padding: '.6rem 1rem',
                textDecoration: 'none', color: isActive ? '#B6FF18' : '#A2A6AB',
                background: isActive ? 'rgba(182,255,24,.08)' : 'transparent',
                borderLeft: isActive ? '3px solid #B6FF18' : '3px solid transparent',
              })}>
                🔐 Configuración
              </NavLink>
            </>
          )}
        </nav>

        <div style={{ padding: '1rem', textAlign: 'center', borderTop: '1px solid rgba(255,255,255,.08)', marginTop: 'auto' }}>
          <img src="https://w7.pngwing.com/pngs/630/424/png-transparent-buenos-aires-museum-of-modern-art-isc-instituto-superior-de-la-carrera-mexico-city-tuv-s-a-buenos-aires-text-trademark-city.png"
            alt="GCBA" style={{ width: 48, height: 48, objectFit: 'contain', opacity: .7, marginBottom: '.5rem' }} />
        </div>
      </aside>
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <header style={{ background: '#1A2C3F', padding: '.7rem 1.5rem', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '1rem' }}>
          <span style={{ color: '#A2A6AB', fontSize: '.9rem' }}>{user?.nombre || user?.telefono}</span>
          {user?.esAdmin && <span style={{ background: '#B6FF18', color: '#1A2C3F', padding: '.15rem .6rem', borderRadius: 4, fontSize: '.75rem', fontWeight: 700 }}>Admin</span>}
          <button className="btn btn-ghost btn-sm" style={{ color: '#FFD700' }} onClick={handleLogout}>Salir</button>
        </header>
        <div style={{ padding: '1.5rem', flex: 1 }}>
          <Outlet />
        </div>
      </main>

      {notificacion && (
        <div onClick={limpiarNotificacion} style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
          background: '#1A2C3F', color: '#B6FF18', padding: '.8rem 1.2rem',
          borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,.3)', cursor: 'pointer',
          maxWidth: 360,
        }}>
          {notificacion}
        </div>
      )}
    </div>
  );
}
