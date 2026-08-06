import { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { api } from '../api/client';
import StatCard from '../components/StatCard';
import { useSocket } from '../context/useSocket';

interface StatsResumen {
  total: number; abiertos: number; en_proceso: number;
  cerrados: number; alta_prioridad: number; usuarios_activos: number;
}

interface StatsBase {
  id: number; nombre: string;
  total: number; abiertos: number; en_proceso: number; cerrados: number;
}

const PIE_COLORS = ['#dc2626', '#d97706', '#16a34a'];
const BAR_COLOR = '#1A2C3F';

export default function DashboardHome() {
  const [stats, setStats] = useState<StatsResumen | null>(null);
  const [porBase, setPorBase] = useState<StatsBase[]>([]);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const { tick } = useSocket();

  useEffect(() => { loadStats(); }, [tick]);

  async function loadStats() {
    try {
      const [resumen, baseData] = await Promise.all([
        api.get<StatsResumen>('/api/stats/resumen'),
        api.get<StatsBase[]>('/api/stats/por-base'),
      ]);
      setStats(resumen);
      setPorBase(baseData);
      setUpdatedAt(new Date());
    } catch {}
  }

  const pieData = stats ? [
    { name: 'Abiertos', value: stats.abiertos },
    { name: 'En proceso', value: stats.en_proceso },
    { name: 'Cerrados', value: stats.cerrados },
  ].filter(d => d.value > 0) : [];

  const barData = porBase.filter(b => b.total > 0);

  return (
    <div>
      <h2>Panel principal</h2>
      {updatedAt && <p style={{ color: 'var(--text-secondary)', fontSize: '.8rem' }}>
        Actualizado {updatedAt.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
      </p>}

      {stats && (
        <div className="card-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
          <StatCard value={stats.total} label="Total tickets" />
          <StatCard value={stats.abiertos} label="Abiertos" color="var(--danger)" />
          <StatCard value={stats.en_proceso} label="En proceso" color="var(--warning)" />
          <StatCard value={stats.cerrados} label="Cerrados" color="var(--success)" />
          <StatCard value={stats.alta_prioridad} label="Alta prioridad" color="var(--danger)" />
          <StatCard value={stats.usuarios_activos} label="Usuarios activos" />
        </div>
      )}

      {/* Charts */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem', marginTop: '1.5rem' }}>
          <div className="card" style={{ padding: '1rem' }}>
            <h3 style={{ marginBottom: '.8rem', fontSize: '.95rem' }}>Distribución</h3>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, value }) => `${name}: ${value}`}>
                  {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {barData.length > 0 && (
            <div className="card" style={{ padding: '1rem' }}>
              <h3 style={{ marginBottom: '.8rem', fontSize: '.95rem' }}>Tickets por base</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={barData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="nombre" width={80} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="total" fill={BAR_COLOR} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
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
        <div className="empty" style={{ marginTop: '2rem' }}>
          <span className="spinner" style={{ marginBottom: '.5rem' }} /><br />
          Cargando estadísticas...
        </div>
      )}
    </div>
  );
}
