import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import { ShieldCheck } from 'lucide-react';
import StatCard from '../components/StatCard';

interface StatsResumen {
  total: number; abiertos: number; en_proceso: number;
  cerrados: number; alta_prioridad: number; usuarios_activos: number;
}

interface StatsBase {
  id: number; nombre: string;
  total: number; abiertos: number; en_proceso: number; cerrados: number;
}

export default function DashboardHome() {
  const { user } = useAuth();
  const [stats, setStats] = useState<StatsResumen | null>(null);
  const [porBase, setPorBase] = useState<StatsBase[]>([]);

  useEffect(() => { loadStats(); }, []);

  async function loadStats() {
    try {
      const [resumen, baseData] = await Promise.all([
        api.get<StatsResumen>('/api/stats/resumen'),
        api.get<StatsBase[]>('/api/stats/por-base'),
      ]);
      setStats(resumen);
      setPorBase(baseData);
    } catch {}
  }

  return (
    <div>
      <h2>Panel principal</h2>

      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
          <StatCard value={stats.total} label="Total tickets" />
          <StatCard value={stats.abiertos} label="Abiertos" color="#dc2626" />
          <StatCard value={stats.en_proceso} label="En proceso" color="var(--warning)" />
          <StatCard value={stats.cerrados} label="Cerrados" color="#16a34a" />
          <StatCard value={stats.alta_prioridad} label="Alta prioridad" color="#dc2626" />
          <StatCard value={stats.usuarios_activos} label="Usuarios activos" />
        </div>
      )}

      {porBase.length > 0 && (
        <div style={{ marginTop: '2rem' }}>
          <h3>Por base</h3>
          <table style={{ marginTop: '.5rem' }}>
            <thead>
              <tr>
                <th>Base</th>
                <th>Total</th>
                <th>Abiertos</th>
                <th>En proceso</th>
                <th>Cerrados</th>
              </tr>
            </thead>
            <tbody>
              {porBase.map(b => (
                <tr key={b.id}>
                  <td>{b.nombre}</td>
                  <td>{b.total}</td>
                  <td><span className="badge badge-abierto">{b.abiertos}</span></td>
                  <td><span className="badge badge-en_proceso">{b.en_proceso}</span></td>
                  <td><span className="badge badge-cerrado">{b.cerrados}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!stats && (
        <div className="card" style={{ marginTop: '1.5rem', padding: '1.5rem' }}>
          <p>Tu usuario: <strong>{user?.telefono}</strong></p>
          {user?.esAdmin && <p style={{ color: 'var(--primary)' }}>
            <ShieldCheck size={16} style={{ marginBottom: -3 }} /> Acceso de administrador
          </p>}
        </div>
      )}
    </div>
  );
}
