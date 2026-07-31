import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';

interface StatsResumen {
  total: number;
  abiertos: number;
  en_proceso: number;
  cerrados: number;
  alta_prioridad: number;
  usuarios_activos: number;
}

interface StatsBase {
  id: number;
  nombre: string;
  total: number;
  abiertos: number;
  en_proceso: number;
  cerrados: number;
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
          <div className="card" style={{ padding: '1rem', textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', fontWeight: 700 }}>{stats.total}</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '.85rem' }}>Total tickets</div>
          </div>
          <div className="card" style={{ padding: '1rem', textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', fontWeight: 700, color: '#dc2626' }}>{stats.abiertos}</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '.85rem' }}>Abiertos</div>
          </div>
          <div className="card" style={{ padding: '1rem', textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', fontWeight: 700, color: '#e76f51' }}>{stats.en_proceso}</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '.85rem' }}>En proceso</div>
          </div>
          <div className="card" style={{ padding: '1rem', textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', fontWeight: 700, color: '#16a34a' }}>{stats.cerrados}</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '.85rem' }}>Cerrados</div>
          </div>
          <div className="card" style={{ padding: '1rem', textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', fontWeight: 700, color: '#dc2626' }}>{stats.alta_prioridad}</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '.85rem' }}>Alta prioridad</div>
          </div>
          <div className="card" style={{ padding: '1rem', textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', fontWeight: 700 }}>{stats.usuarios_activos}</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '.85rem' }}>Usuarios activos</div>
          </div>
        </div>
      )}

      {porBase.length > 0 && (
        <div style={{ marginTop: '2rem' }}>
          <h3>Por base</h3>
          <table className="table" style={{ marginTop: '.5rem' }}>
            <thead>
              <tr>
                <th>Base</th>
                <th>Total</th>
                <th>🔴 Abiertos</th>
                <th>🟡 En proceso</th>
                <th>✅ Cerrados</th>
              </tr>
            </thead>
            <tbody>
              {porBase.map(b => (
                <tr key={b.id}>
                  <td>{b.nombre}</td>
                  <td>{b.total}</td>
                  <td style={{ color: b.abiertos > 0 ? '#dc2626' : 'var(--text-secondary)' }}>{b.abiertos}</td>
                  <td style={{ color: b.en_proceso > 0 ? '#e76f51' : 'var(--text-secondary)' }}>{b.en_proceso}</td>
                  <td style={{ color: b.cerrados > 0 ? '#16a34a' : 'var(--text-secondary)' }}>{b.cerrados}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!stats && (
        <div className="card" style={{ marginTop: '1.5rem', padding: '1.5rem' }}>
          <p>Tu usuario: <strong>{user?.telefono}</strong></p>
          {user?.esAdmin && <p style={{ color: 'var(--primary)' }}>🔑 Acceso de administrador</p>}
        </div>
      )}
    </div>
  );
}
