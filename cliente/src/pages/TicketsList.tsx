import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';
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

interface PaginatedResponse {
  data: Ticket[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const ESTADOS = ['abierto', 'en_proceso', 'cerrado'];
const PRIORIDADES = ['baja', 'media', 'alta'];
const PAGE_SIZE = 20;

export default function TicketsList() {
  const { user } = useAuth();
  const { tick } = useSocket();
  const navigate = useNavigate();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroPrioridad, setFiltroPrioridad] = useState('');
  const [soloMios, setSoloMios] = useState(false);
  const [search, setSearch] = useState('');
  const [sinAsignar, setSinAsignar] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchTickets = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('limit', String(PAGE_SIZE));
    if (filtroEstado) params.set('estado', filtroEstado);
    if (filtroPrioridad) params.set('prioridad', filtroPrioridad);
    if (soloMios && user?.nombre) params.set('tecnicoAsignado', user.nombre);
    if (sinAsignar) params.set('sinAsignar', 'true');
    if (search.trim()) params.set('search', search.trim());
    api.get<PaginatedResponse>(`/api/tickets?${params}`)
      .then(res => {
        setTickets(res.data);
        setTotal(res.total);
        setTotalPages(res.totalPages);
        if (res.totalPages > 0 && page > res.totalPages) setPage(res.totalPages);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [filtroEstado, filtroPrioridad, soloMios, sinAsignar, search, page, user?.nombre]);

  useEffect(() => { fetchTickets(); }, [fetchTickets, tick]);

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '.5rem' }}>
        <h2 style={{ margin: 0 }}>Tickets</h2>
        <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
            <input
              type="text"
              placeholder="Buscar..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              style={{ padding: '.4rem .6rem .4rem 1.7rem', borderRadius: 6, border: '1px solid var(--border)', fontSize: '.85rem', width: 200 }}
            />
          </div>
          <select value={filtroEstado} onChange={e => { setFiltroEstado(e.target.value); setPage(1); }}
            style={{ padding: '.4rem .6rem', borderRadius: 6, border: '1px solid var(--border)' }}>
            <option value="">Todos los estados</option>
            {ESTADOS.map(e => <option key={e} value={e}>{e.replace('_', ' ')}</option>)}
          </select>
          <select value={filtroPrioridad} onChange={e => { setFiltroPrioridad(e.target.value); setPage(1); }}
            style={{ padding: '.4rem .6rem', borderRadius: 6, border: '1px solid var(--border)' }}>
            <option value="">Todas las prioridades</option>
            {PRIORIDADES.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          {user?.esAdmin && (
            <>
              <label style={{ display: 'flex', alignItems: 'center', gap: '.3rem', fontSize: '.85rem', cursor: 'pointer', padding: '.4rem .6rem', border: '1px solid var(--border)', borderRadius: 6, background: soloMios ? 'var(--bg)' : 'transparent' }}>
                <input type="checkbox" checked={soloMios} onChange={e => { setSoloMios(e.target.checked); setPage(1); }} />
                Mis tickets
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '.3rem', fontSize: '.85rem', cursor: 'pointer', padding: '.4rem .6rem', border: '1px solid var(--border)', borderRadius: 6, background: sinAsignar ? 'var(--bg)' : 'transparent' }}>
                <input type="checkbox" checked={sinAsignar} onChange={e => { setSinAsignar(e.target.checked); setPage(1); }} />
                Sin técnico
              </label>
            </>
          )}
        </div>
      </div>

      {loading ? (
        <div className="empty"><span className="spinner" /><br />Cargando tickets...</div>
      ) : tickets.length === 0 ? (
        <p className="empty">{search || filtroEstado || filtroPrioridad || soloMios || sinAsignar ? 'No se encontraron tickets con esos filtros.' : 'No hay tickets'}</p>
      ) : (
        <>
          <div className="table-wrap"><table>
            <thead>
              <tr>
                <th>#</th>
                <th>Asunto</th>
                <th>Base</th>
                <th>Estado</th>
                <th>Técnico</th>
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
                  <td style={{ fontSize: '.85rem' }}>{t.tecnicoAsignado || '—'}</td>
                  <td style={{ fontSize: '.85rem', color: 'var(--text-secondary)' }}>
                    {new Date(t.createdAt).toLocaleDateString('es-AR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>

          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', padding: '1rem 0' }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}>
                <ChevronLeft size={16} />
              </button>
              <span style={{ fontSize: '.85rem', color: 'var(--text-secondary)' }}>
                {page} de {totalPages} ({total} tickets)
              </span>
              <button className="btn btn-ghost btn-sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
