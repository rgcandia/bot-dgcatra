import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ClipboardCheck, CircleCheckBig, UserPlus, Save, X } from 'lucide-react';
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
  const navigate = useNavigate();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [tecnicos, setTecnicos] = useState<Tecnico[]>([]);
  const [loading, setLoading] = useState(true);
  const [solucion, setSolucion] = useState('');
  const [error, setError] = useState('');
  const [editTecnico, setEditTecnico] = useState(false);
  const [techSel, setTechSel] = useState('');

  useEffect(() => {
    Promise.all([
      api.get<Ticket>(`/api/tickets/${id}`),
      api.get<Tecnico[]>('/api/auth/admins'),
    ]).then(([t, a]) => { setTicket(t); setTecnicos(a); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  async function guardarCambios(payload: Record<string, any>) {
    setError('');
    try {
      const updated = await api.patch<Ticket>(`/api/tickets/${id}`, payload);
      setTicket(updated);
      setEditTecnico(false);
    } catch (e: any) { setError(e.message); }
  }

  async function adoptar() {
    const nombre = user?.nombre || user?.telefono || 'Admin';
    guardarCambios({ estado: 'en_proceso', tecnicoAsignado: nombre });
  }

  async function derivar() {
    if (!techSel) return;
    guardarCambios({ estado: 'en_proceso', tecnicoAsignado: techSel });
  }

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

  const puedeAdoptar = user?.esAdmin && ticket.estado === 'abierto';
  const puedeCerrar = user?.esAdmin && ticket.estado === 'en_proceso';
  const puedeReabrir = user?.superAdmin && ticket.estado === 'cerrado';
  const historial: any[] = Array.isArray(ticket.historial) ? ticket.historial : [];

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
                  <select value={ticket.estado} onChange={e => guardarCambios({ estado: e.target.value })}>
                    <option value="abierto">Abierto</option>
                    <option value="en_proceso">En proceso</option>
                    <option value="cerrado">Cerrado</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontWeight: 600, fontSize: '.85rem', marginRight: '.5rem' }}>Prioridad:</label>
                  <select value={ticket.prioridad} onChange={e => guardarCambios({ prioridad: e.target.value })}>
                    <option value="baja">Baja</option>
                    <option value="media">Media</option>
                    <option value="alta">Alta</option>
                  </select>
                </div>
              </div>

              {!editTecnico ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
                  <span style={{ fontWeight: 600, fontSize: '.85rem' }}>Técnico:</span>
                  <span style={{ fontSize: '.9rem' }}>{ticket.tecnicoAsignado || '—'}</span>
                  <button className="btn btn-ghost btn-sm" onClick={() => { setTechSel(ticket.tecnicoAsignado || ''); setEditTecnico(true); }}>
                    Cambiar
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', flexWrap: 'wrap' }}>
                  <label style={{ fontWeight: 600, fontSize: '.85rem' }}>Técnico:</label>
                  <select value={techSel} onChange={e => setTechSel(e.target.value)}>
                    <option value="">— Sin asignar —</option>
                    {tecnicos.map(t => <option key={t.id} value={t.nombre}>{t.nombre}</option>)}
                  </select>
                  <button className="btn btn-primary btn-sm" onClick={() => guardarCambios({ tecnicoAsignado: techSel || null })}>
                    <Save size={14} /> Guardar
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setEditTecnico(false)}>
                    <X size={14} /> Cancelar
                  </button>
                </div>
              )}
            </>
          )}

          {puedeAdoptar && (
            <div style={{ display: 'flex', gap: '.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <button className="btn btn-primary" onClick={adoptar}>
                <ClipboardCheck size={18} /> Adoptar caso
              </button>
              {user?.superAdmin && (
                <>
                  <span style={{ color: 'var(--text-secondary)' }}>o derivar a:</span>
                  <select value={techSel} onChange={e => setTechSel(e.target.value)} style={{ width: 160 }}>
                    <option value="">— Elegir —</option>
                    {tecnicos.map(t => <option key={t.id} value={t.nombre}>{t.nombre}</option>)}
                  </select>
                  <button className="btn btn-primary" onClick={derivar} disabled={!techSel}>
                    <UserPlus size={18} /> Derivar
                  </button>
                </>
              )}
            </div>
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
            <button className="btn btn-primary" onClick={() => guardarCambios({ estado: 'abierto' })}>
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
