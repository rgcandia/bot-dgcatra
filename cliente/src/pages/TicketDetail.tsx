import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ClipboardCheck, CircleCheckBig } from 'lucide-react';
import { api } from '../api/client';

interface Ticket {
  id: number; asunto: string; descripcion: string; ubicacion: string;
  estado: string; prioridad: string; tecnicoAsignado: string | null;
  solucion: string | null; historial: any[]; createdAt: string;
  usuario: { nombreCompleto: string; telefono: string };
  base: { nombre: string }; sector: { nombre: string } | null;
}

export default function TicketDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [solucion, setSolucion] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    api.get<Ticket>(`/api/tickets/${id}`)
      .then(setTicket)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  async function cerrar() {
    if (!solucion.trim()) return;
    setError('');
    try {
      const updated = await api.patch<Ticket>(`/api/tickets/${id}`, { estado: 'cerrado', solucion: solucion.trim() });
      setTicket(updated);
      setSolucion('');
    } catch (e: any) { setError(e.message); }
  }

  if (loading) return <div className="empty"><span className="spinner" /><br />Cargando ticket...</div>;
  if (!ticket) return <p className="empty">Ticket no encontrado</p>;

  const puedeAdoptar = user?.esAdmin && ticket!.estado === 'abierto';
  const puedeCerrar = user?.esAdmin && ticket!.estado === 'en_proceso';
  const puedeReabrir = user?.superAdmin && ticket!.estado === 'cerrado';
  const historial: any[] = Array.isArray(ticket!.historial) ? ticket!.historial : [];

  async function cambiarEstado(nuevoEstado: string) {
    setError('');
    try {
      const updated = await api.patch<Ticket>(`/api/tickets/${ticket!.id}`, { estado: nuevoEstado, tecnicoAsignado: nuevoEstado === 'en_proceso' ? (user?.nombre || user?.telefono) : undefined });
      setTicket(updated);
    } catch (e: any) { setError(e.message); }
  }

  return (
    <div style={{ maxWidth: 800 }}>
      <button className="btn btn-ghost btn-sm" onClick={() => navigate('/tickets')} style={{ marginBottom: '1rem' }}>
        ← Volver a tickets
      </button>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h2 style={{ margin: 0 }}>{ticket.asunto}</h2>
            <p style={{ color: 'var(--text-secondary)', margin: '.3rem 0' }}>
              #{ticket.id} · {ticket.base?.nombre}{ticket.sector ? ` · ${ticket.sector.nombre}` : ''} · {ticket.ubicacion}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '.5rem', alignItems: 'center' }}>
            <span className={`badge badge-${ticket.estado}`}>{ticket.estado.replace('_', ' ')}</span>
            <span className={`badge badge-${ticket.prioridad}`}>{ticket.prioridad.toUpperCase()}</span>
          </div>
        </div>
        <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '1rem 0' }} />
        <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{ticket.descripcion}</p>
        <div style={{ marginTop: '1rem', fontSize: '.85rem', color: 'var(--text-secondary)' }}>
          <strong>Reportó:</strong> {ticket.usuario?.nombreCompleto || ticket.usuario?.telefono}
          {ticket.tecnicoAsignado && <> · <strong>Técnico:</strong> {ticket.tecnicoAsignado}</>}
          <> · {new Date(ticket.createdAt).toLocaleString('es-AR')}</>
        </div>
      </div>

      {error && <p style={{ color: 'var(--danger)', marginBottom: '1rem' }}>{error}</p>}

      {user?.esAdmin && (
        <div className="card" style={{ marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '.8rem' }}>
          {user?.superAdmin && (
            <>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <div>
                  <label style={{ fontWeight: 600, fontSize: '.85rem', marginRight: '.5rem' }}>Estado:</label>
                  <select value={ticket.estado} onChange={e => cambiarEstado(e.target.value)}>
                    <option value="abierto">Abierto</option>
                    <option value="en_proceso">En proceso</option>
                    <option value="cerrado">Cerrado</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontWeight: 600, fontSize: '.85rem', marginRight: '.5rem' }}>Prioridad:</label>
                  <select
                    value={ticket.prioridad}
                    onChange={async e => {
                      try { setTicket(await api.patch<Ticket>(`/api/tickets/${ticket.id}`, { prioridad: e.target.value })); }
                      catch (e: any) { setError(e.message); }
                    }}>
                    <option value="baja">Baja</option>
                    <option value="media">Media</option>
                    <option value="alta">Alta</option>
                  </select>
                </div>
              </div>
              <div>
                <label style={{ fontWeight: 600, fontSize: '.85rem', marginRight: '.5rem' }}>Técnico:</label>
                <input
                  value={ticket.tecnicoAsignado || ''}
                  onChange={e => {
                    setTicket({ ...ticket, tecnicoAsignado: e.target.value });
                  }}
                  onBlur={async () => {
                    try {
                      setTicket(await api.patch<Ticket>(`/api/tickets/${ticket.id}`, { tecnicoAsignado: ticket.tecnicoAsignado }));
                    } catch (e: any) { setError(e.message); }
                  }}
                  placeholder="Nombre del técnico"
                  style={{ padding: '.4rem .6rem', borderRadius: 6, border: '1px solid var(--border)', width: 200 }}
                />
              </div>
            </>
          )}

          {puedeAdoptar && (
            <button className="btn btn-primary" onClick={() => cambiarEstado('en_proceso')}>
              <ClipboardCheck size={18} /> Adoptar caso
            </button>
          )}
          {puedeCerrar && (
            <div>
              <textarea value={solucion} onChange={e => setSolucion(e.target.value)} placeholder="Describí la solución..." rows={3}
                style={{ width: '100%', padding: '.6rem', borderRadius: 6, border: '1px solid var(--border)', resize: 'vertical', marginBottom: '.5rem' }} />
              <button className="btn btn-primary" onClick={cerrar} disabled={!solucion.trim()}>
                <CircleCheckBig size={18} /> Cerrar ticket
              </button>
            </div>
          )}
          {puedeReabrir && (
            <button className="btn btn-primary" onClick={() => cambiarEstado('abierto')}>
              <ClipboardCheck size={18} /> Reabrir ticket
            </button>
          )}
        </div>
      )}

      {ticket.solucion && (
        <div className="card" style={{ marginBottom: '1.5rem', background: '#f0fdf4' }}>
          <h3 style={{ margin: '0 0 .5rem', color: '#16a34a' }}>
            <CircleCheckBig size={16} /> Solución
          </h3>
          <p style={{ whiteSpace: 'pre-wrap' }}>{ticket.solucion}</p>
        </div>
      )}

      {historial.length > 0 && (
        <div className="card">
          <h3 style={{ margin: '0 0 .8rem' }}>Historial</h3>
          {historial.map((h, i) => (
            <div key={i} style={{
              padding: '.5rem 0', borderBottom: i < historial.length - 1 ? '1px solid var(--border)' : 'none',
              fontSize: '.85rem', color: 'var(--text-secondary)',
            }}>
              <span style={{ color: '#1e293b' }}>{h.accion}</span>
              {h.autor && <> · <strong>{h.autor}</strong></>}
              {h.timestamp && <> · {new Date(h.timestamp).toLocaleString('es-AR')}</>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
