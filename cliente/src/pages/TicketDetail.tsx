import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/useSocket';
import { ClipboardCheck, CircleCheckBig, UserPlus, RotateCcw, User, UserX } from 'lucide-react';
import { api } from '../api/client';

interface Ticket {
  id: number; asunto: string; descripcion: string; ubicacion: string;
  estado: string; prioridad: string; tecnicoAsignado: string | null;
  solucion: string | null; historial: any[]; createdAt: string;
  usuario: { nombreCompleto: string; telefono: string };
  base: { nombre: string }; sector: { nombre: string } | null;
}

interface Tecnico { id: string; nombre: string; }

export default function TicketDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const { ticketActualizado } = useSocket();
  const navigate = useNavigate();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [tecnicos, setTecnicos] = useState<Tecnico[]>([]);
  const [loading, setLoading] = useState(true);
  const [solucion, setSolucion] = useState('');
  const [error, setError] = useState('');
  const [techSel, setTechSel] = useState('');

  useEffect(() => {
    Promise.all([
      api.get<Ticket>(`/api/tickets/${id}`),
      api.get<Tecnico[]>('/api/auth/admins'),
    ]).then(([t, a]) => { setTicket(t); setTecnicos(a); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (ticketActualizado && ticketActualizado.id === Number(id)) {
      setTicket(ticketActualizado);
    }
  }, [ticketActualizado, id]);

  async function patch(payload: Record<string, any>) {
    setError('');
    try { setTicket(await api.patch<Ticket>(`/api/tickets/${id}`, payload)); }
    catch (e: any) { setError(e.message); }
  }

  async function adoptar() {
    patch({ estado: 'en_proceso', tecnicoAsignado: user?.nombre || user?.telefono || 'Admin' });
  }

  async function derivar() {
    if (!techSel) return;
    patch({ estado: 'en_proceso', tecnicoAsignado: techSel });
  }

  async function cerrar() {
    if (!solucion.trim()) return;
    setError('');
    try {
      setTicket(await api.patch<Ticket>(`/api/tickets/${id}`, { estado: 'cerrado', solucion: solucion.trim() }));
      setSolucion('');
    } catch (e: any) { setError(e.message); }
  }

  if (loading) return <div className="empty"><span className="spinner" /><br />Cargando ticket...</div>;
  if (!ticket) return <p className="empty">Ticket no encontrado</p>;

  const puedeActuar = user?.esAdmin && ticket.estado === 'abierto';
  const puedeCerrar = user?.esAdmin && ticket.estado === 'en_proceso' && ticket.tecnicoAsignado === (user?.nombre || user?.telefono);
  const puedeReabrir = user?.superAdmin && ticket.estado === 'cerrado';
  const soyElTecnico = ticket.tecnicoAsignado && ticket.tecnicoAsignado === (user?.nombre || user?.telefono);
  const historial: any[] = Array.isArray(ticket.historial) ? ticket.historial : [];

  return (
    <div style={{ maxWidth: 800 }}>
      <button className="btn btn-ghost btn-sm" onClick={() => navigate('/tickets')} style={{ marginBottom: '1rem' }}>
        ← Volver a tickets
      </button>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
          <div>
            <h2 style={{ margin: 0 }}>#{ticket.id} — {ticket.asunto}</h2>
            <p style={{ color: 'var(--text-secondary)', margin: '.3rem 0 0', fontSize: '.85rem' }}>
              {ticket.base?.nombre}{ticket.sector ? ` · ${ticket.sector.nombre}` : ''} · {ticket.ubicacion} · {new Date(ticket.createdAt).toLocaleString('es-AR')}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '.5rem' }}>
            <span className={`badge badge-${ticket.estado}`}>{ticket.estado.replace('_', ' ')}</span>
            <span className={`badge badge-${ticket.prioridad}`}>{ticket.prioridad.toUpperCase()}</span>
          </div>
        </div>

        <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6, background: 'var(--bg)', padding: '1rem', borderRadius: 6 }}>
          {ticket.descripcion}
        </p>

        <div style={{ marginTop: '.8rem', fontSize: '.85rem', color: 'var(--text-secondary)', display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
          <span><strong>Reportó:</strong> {ticket.usuario?.nombreCompleto || ticket.usuario?.telefono}</span>
          {ticket.tecnicoAsignado && <span><User size={14} style={{ marginBottom: -2 }} /> {ticket.tecnicoAsignado}</span>}
        </div>
      </div>

      {error && <p style={{ color: 'var(--danger)', marginBottom: '1rem' }}>{error}</p>}

      {user?.esAdmin && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>

          {user?.superAdmin && (
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: puedeActuar ? '1rem' : '0', paddingBottom: puedeActuar ? '1rem' : '0', borderBottom: puedeActuar ? '1px solid var(--border)' : 'none' }}>
              <div>
                <label style={{ fontWeight: 600, fontSize: '.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '.2rem' }}>Estado</label>
                <select value={ticket.estado} onChange={e => patch({ estado: e.target.value })}>
                  <option value="abierto">Abierto</option>
                  <option value="en_proceso">En proceso</option>
                  <option value="cerrado">Cerrado</option>
                </select>
              </div>
              <div>
                <label style={{ fontWeight: 600, fontSize: '.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '.2rem' }}>Prioridad</label>
                <select value={ticket.prioridad} onChange={e => patch({ prioridad: e.target.value })}>
                  <option value="baja">Baja</option>
                  <option value="media">Media</option>
                  <option value="alta">Alta</option>
                </select>
              </div>
              {!puedeActuar && (
                <div>
                  <label style={{ fontWeight: 600, fontSize: '.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '.2rem' }}>Técnico</label>
                  <select value={ticket.tecnicoAsignado || ''} onChange={e => patch({ tecnicoAsignado: e.target.value || null })}>
                    <option value="">— Sin asignar —</option>
                    {tecnicos.map(t => <option key={t.id} value={t.nombre}>{t.nombre}</option>)}
                  </select>
                </div>
              )}
            </div>
          )}

          {puedeActuar && (
            <div style={{ display: 'flex', gap: '.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <button className="btn btn-primary" onClick={adoptar}>
                <ClipboardCheck size={18} /> Adoptar caso
              </button>
              {user?.superAdmin && (
                <>
                  <span style={{ color: 'var(--text-secondary)', margin: '0 .2rem' }}>o</span>
                  <select value={techSel} onChange={e => setTechSel(e.target.value)} style={{ width: 160 }}>
                    <option value="">Derivar a...</option>
                    {tecnicos.map(t => <option key={t.id} value={t.nombre}>{t.nombre}</option>)}
                  </select>
                  <button className="btn btn-primary" onClick={derivar} disabled={!techSel}>
                    <UserPlus size={18} />
                  </button>
                </>
              )}
            </div>
          )}

          {puedeCerrar && (
            <div>
              <label style={{ fontWeight: 600, fontSize: '.85rem', marginBottom: '.3rem', display: 'block' }}>Solución</label>
              <textarea value={solucion} onChange={e => setSolucion(e.target.value)} placeholder="Describí la solución..." rows={3}
                style={{ width: '100%', padding: '.6rem', borderRadius: 6, border: '1px solid var(--border)', resize: 'vertical', marginBottom: '.5rem' }} />
              <div style={{ display: 'flex', gap: '.5rem' }}>
                <button className="btn btn-primary" onClick={cerrar} disabled={!solucion.trim()}>
                  <CircleCheckBig size={18} /> Cerrar ticket
                </button>
                <button className="btn btn-ghost" onClick={() => patch({ tecnicoAsignado: null, estado: 'abierto' })} style={{ color: 'var(--danger)' }}>
                  <UserX size={18} /> Dejar caso
                </button>
              </div>
            </div>
          )}

          {puedeReabrir && (
            <button className="btn btn-primary" onClick={() => patch({ estado: 'abierto' })}>
              <RotateCcw size={18} /> Reabrir ticket
            </button>
          )}

          {soyElTecnico && ticket.estado === 'en_proceso' && !puedeCerrar && (
            <button className="btn btn-ghost" onClick={() => patch({ tecnicoAsignado: null, estado: 'abierto' })} style={{ color: 'var(--danger)' }}>
              <UserX size={18} /> Dejar caso
            </button>
          )}

          {!puedeActuar && !puedeCerrar && !puedeReabrir && !soyElTecnico && user?.esAdmin && !user?.superAdmin && (
            <p style={{ color: 'var(--text-secondary)', fontSize: '.85rem', textAlign: 'center' }}>
              Este ticket está {ticket.estado === 'cerrado' ? 'cerrado' : 'en proceso'}. Solo el administrador principal puede modificar su estado.
            </p>
          )}
        </div>
      )}

      {ticket.solucion && (
        <div className="card" style={{ marginBottom: '1.5rem', background: '#f0fdf4' }}>
          <h3 style={{ margin: '0 0 .5rem', color: '#16a34a' }}>
            <CircleCheckBig size={16} style={{ marginBottom: -3 }} /> Solución
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
