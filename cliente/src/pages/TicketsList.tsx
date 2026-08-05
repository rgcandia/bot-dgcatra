import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import { useSocket } from '../context/useSocket';

interface Ticket {
  id: number; asunto: string; descripcion: string; ubicacion: string;
  estado: string; prioridad: string; createdAt: string;
  tecnicoAsignado: string | null;
  usuario: { nombreCompleto: string; telefono: string };
  base: { nombre: string }; sector: { nombre: string } | null;
}

const ESTADOS = ['abierto', 'en_proceso', 'cerrado'];
const PRIORIDADES = ['baja', 'media', 'alta'];

export default function TicketsList() {
  const { user } = useAuth();
  const { tick } = useSocket();
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
    api.get<Ticket[]>(`/api/tickets?${params}`)
      .then(setTickets)
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => { fetchTickets(); }, [filtroEstado, filtroPrioridad, tick]);

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
        <div className="empty"><span className="spinner" /><br />Cargando tickets...</div>
      ) : tickets.length === 0 ? (
        <p className="empty">No hay tickets</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Asunto</th>
              <th>Base</th>
              <th>Estado</th>
              <th>Prioridad</th>
              <th>Fecha</th>
            </tr>
          </thead>
          <tbody>
            {tickets.map(t => (
              <tr key={t.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/tickets/${t.id}`)}>
                <td style={{ color: 'var(--text-secondary)', fontSize: '.85rem' }}>#{t.id}</td>
                <td style={{ fontWeight: 500 }}>{t.asunto}</td>
                <td>{t.base?.nombre}</td>
                <td><span className={`badge badge-${t.estado}`}>{t.estado.replace('_', ' ')}</span></td>
                <td><span className={`badge badge-${t.prioridad}`}>{t.prioridad.toUpperCase()}</span></td>
                <td style={{ fontSize: '.85rem', color: 'var(--text-secondary)' }}>
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
