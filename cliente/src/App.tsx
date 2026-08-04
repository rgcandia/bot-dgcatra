import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import DashboardLayout from './layouts/DashboardLayout';
import DashboardHome from './pages/DashboardHome';
import TicketsList from './pages/TicketsList';
import TicketDetail from './pages/TicketDetail';
import BasesPage from './pages/admin/BasesPage';
import SectoresPage from './pages/admin/SectoresPage';
import UsuariosPage from './pages/admin/UsuariosPage';
import SettingsPage from './pages/admin/SettingsPage';

function Private({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  return user ? <>{children}</> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<Private><DashboardLayout /></Private>}>
        <Route index element={<DashboardHome />} />
        <Route path="tickets" element={<TicketsList />} />
        <Route path="tickets/:id" element={<TicketDetail />} />
        <Route path="admin/bases" element={<BasesPage />} />
        <Route path="admin/sectores" element={<SectoresPage />} />
        <Route path="admin/usuarios" element={<UsuariosPage />} />
        <Route path="admin/settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  );
}
