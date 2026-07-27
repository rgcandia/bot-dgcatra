import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const API = import.meta.env.VITE_API_URL || '';

interface Ticket {
  id: number;
  asunto: string;
  descripcion: string;
  ubicacion: string;
  estado: string;
  prioridad: string;
  createdAt: string;
  tecnicoAsignado: string | null;
  usuario: { nombreCompleto: string; telefono: string };
  base: { nombre: string };
  sector: { nombre: string } | null;
}

const ESTADOS = ['abierto', 'en_proceso', 'cerrado'];
const PRIORIDADES = ['baja', 'media', 'alta'];
const PRIORIDAD_COLORS: Record<string, string> = { baja: '#6b7280', media: '#e76f51', alta: '#dc2626' };
const ESTADO_COLORS: Record<string, string> = { abierto: '#dc2626', en_proceso: '#e76f51', cerrado: '#16a34a' };

export default function TicketsList() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroPrioridad, setFiltroPrioridad] = useState('');

  function fetchTickets() {
    setLoading(true);
    const params = new URLSearchParams();
    if (filtroEstado) params.set('estado', filtroEstado);
    if (filtroPrioridad) params.set('prioridad', filtroPrioridad);
    fetch(`${API}/api/tickets?${params}`, {
      headers: { Authorization: `Bearer ${user?.token}` },
    })
      .then(r => r.json())
      .then(setTickets)
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => { fetchTickets(); }, [filtroEstado, filtroPrioridad]);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2 style={{ margin: 0 }}>Tickets</h2>
        <div style={{ display: 'flex', gap: '.5rem' }}>
          <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}
            style={{ padding: '.4rem .6rem', borderRadius: 6, border: '1px solid var(--border)' }}>
            <option value="">Todos los estados</option>
            {ESTADOS.map(e => <option key={e} value={e}>{e.replace('_', ' ')}</option>)}
          </select>
          <select value={filtroPrioridad} onChange={e => setFiltroPrioridad(e.target.value)}
            style={{ padding: '.4rem .6rem', borderRadius: 6, border: '1px solid var(--border)' }}>
            <option value="">Todas las prioridades</option>
            {PRIORIDADES.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <p className="empty">Cargando tickets...</p>
      ) : tickets.length === 0 ? (
        <p className="empty">No hay tickets</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--border)', textAlign: 'left' }}>
              <th style={{ padding: '.6rem .4rem' }}>ID</th>
              <th style={{ padding: '.6rem .4rem' }}>Asunto</th>
              <th style={{ padding: '.6rem .4rem' }}>Usuario</th>
              <th style={{ padding: '.6rem .4rem' }}>Base</th>
              <th style={{ padding: '.6rem .4rem' }}>Estado</th>
              <th style={{ padding: '.6rem .4rem' }}>Prioridad</th>
              <th style={{ padding: '.6rem .4rem' }}>Técnico</th>
              <th style={{ padding: '.6rem .4rem' }}>Fecha</th>
            </tr>
          </thead>
          <tbody>
            {tickets.map(t => (
              <tr key={t.id}
                style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                onClick={() => navigate(`/tickets/${t.id}`)}>
                <td style={{ padding: '.6rem .4rem' }}>#{t.id}</td>
                <td style={{ padding: '.6rem .4rem', fontWeight: 500 }}>{t.asunto}</td>
                <td style={{ padding: '.6rem .4rem' }}>{t.usuario?.nombreCompleto || t.usuario?.telefono}</td>
                <td style={{ padding: '.6rem .4rem' }}>{t.base?.nombre}</td>
                <td style={{ padding: '.6rem .4rem' }}>
                  <span className={`badge badge-${t.estado}`}>{t.estado.replace('_', ' ')}</span>
                </td>
                <td style={{ padding: '.6rem .4rem' }}>
                  <span style={{ color: PRIORIDAD_COLORS[t.prioridad] || '#6b7280', fontWeight: 600, fontSize: '.8rem' }}>
                    {t.prioridad.toUpperCase()}
                  </span>
                </td>
                <td style={{ padding: '.6rem .4rem' }}>{t.tecnicoAsignado || '—'}</td>
                <td style={{ padding: '.6rem .4rem', fontSize: '.85rem', color: 'var(--text-secondary)' }}>
                  {new Date(t.createdAt).toLocaleDateString('es-AR')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
