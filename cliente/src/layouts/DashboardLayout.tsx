import { Outlet, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Ticket, Building2, Settings2, Users, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/useSocket';
import NavItem from '../components/NavItem';

export default function DashboardLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { notificacion, limpiarNotificacion } = useSocket();

  function handleLogout() { logout(); navigate('/login', { replace: true }); }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <aside style={{ width: 220, background: '#1A2C3F', color: '#fff', padding: '1.5rem 0', display: 'flex', flexDirection: 'column' }}>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 0, flex: 1 }}>
          <NavItem to="/" icon={<LayoutDashboard size={18} />} label="Inicio" end />
          <NavItem to="/tickets" icon={<Ticket size={18} />} label="Tickets" />

          {user?.esAdmin && (
            <>
              <div style={{ color: '#FFD700', fontSize: '.65rem', padding: '1.5rem 1rem .3rem', textTransform: 'uppercase', letterSpacing: 2 }}>
                Administración
              </div>
              <NavItem to="/admin/bases" icon={<Building2 size={18} />} label="Bases" />
              <NavItem to="/admin/sectores" icon={<Settings2 size={18} />} label="Sectores" />
              <NavItem to="/admin/usuarios" icon={<Users size={18} />} label="Usuarios" />
              <NavItem to="/admin/settings" icon={<ShieldCheck size={18} />} label="Configuración" />
            </>
          )}
        </nav>

        <div style={{ padding: '1rem', borderTop: '1px solid rgba(255,255,255,.08)' }}>
          <div style={{ textAlign: 'center', marginBottom: '.5rem' }}>
            <img src="/logo-small.png" alt="" style={{ width: 70, height: 'auto', filter: 'brightness(0) invert(1)' }} />
          </div>
          <p style={{ color: '#A2A6AB', fontSize: '.85rem', marginBottom: '.3rem', textAlign: 'center' }}>
            {user?.nombre || user?.telefono || 'Usuario'}
          </p>
          <button className="btn btn-ghost btn-sm" style={{ color: '#FFD700', width: '100%', justifyContent: 'center' }} onClick={handleLogout}>
            Salir
          </button>
        </div>
      </aside>

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
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
