import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/useSocket';
import {
  ClipboardCheck, CircleCheckBig, UserPlus, RotateCcw, User, UserX,
  Building2, Settings2, MapPin, Calendar, Clock, UserCheck,
  AlertCircle, Play, ArrowRightCircle, ArrowLeft, MessageCircle,
} from 'lucide-react';
import { api } from '../api/client';

interface Ticket {
  id: number; asunto: string; descripcion: string; ubicacion: string;
  estado: string; prioridad: string; tecnicoAsignado: string | null;
  solucion: string | null; historial: any[]; createdAt: string;
  usuario: { nombreCompleto: string; telefono: string };
  base: { nombre: string }; sector: { nombre: string } | null;
}

interface Tecnico { id: string; nombre: string; }

interface Msg { id: number; mensaje: string; direccion: string; createdAt: string; }

const ESTADO_LABEL: Record<string, string> = {
  abierto: 'Abierto',
  en_proceso: 'En proceso',
  cerrado: 'Cerrado',
};

const PRIORIDAD_COLOR: Record<string, string> = {
  baja: 'var(--text-secondary)',
  media: 'var(--warning)',
  alta: 'var(--danger)',
};

function formatFecha(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' }) +
    ' ' + d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}

function iconoHistorial(accion: string) {
  if (accion.includes('creó el ticket')) return <Play size={12} />;
  if (accion.includes('puso en proceso') || accion.includes('cerró') || accion.includes('reabrió')) return <ArrowRightCircle size={12} />;
  if (accion.includes('asignó') || accion.includes('desvinculó')) return <UserCheck size={12} />;
  if (accion.includes('prioridad')) return <AlertCircle size={12} />;
  if (accion.includes('solución')) return <CircleCheckBig size={12} />;
  return <Clock size={12} />;
}

function colorHistorial(accion: string) {
  if (accion.includes('cerró') || accion.includes('solución')) return 'var(--success)';
  if (accion.includes('reabrió') || accion.includes('puso en proceso') || accion.includes('asignó') || accion.includes('desvinculó')) return '#6366f1';
  return 'var(--text-secondary)';
}

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
  const [conversacion, setConversacion] = useState<Msg[]>([]);

  useEffect(() => {
    Promise.all([
      api.get<Ticket>(`/api/tickets/${id}`),
      api.get<Tecnico[]>('/api/auth/admins'),
    ]).then(([t, a]) => { setTicket(t); setTecnicos(a); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    api.get<Msg[]>(`/api/tickets/${id}/conversacion`)
      .then(setConversacion)
      .catch(() => {});
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
  const historial: any[] = Array.isArray(ticket.historial) ? [...ticket.historial].reverse() : [];

  return (
    <div style={{ maxWidth: 780, margin: '0 auto' }}>
      {/* ── Back button ── */}
      <button className="btn btn-ghost btn-sm" onClick={() => navigate('/tickets')} style={{ marginBottom: '1.5rem' }}>
        <ArrowLeft size={16} /> Volver a tickets
      </button>

      {/* ── Error ── */}
      {error && (
        <p style={{ color: 'var(--danger)', marginBottom: '1rem', fontSize: '.9rem' }}>{error}</p>
      )}

      {/* ═══════════════════════════ Card: Info ═══════════════════════════ */}
      <div className="card" style={{ marginBottom: '1.5rem', padding: '2rem' }}>

        {/* Header */}
        <div style={{ marginBottom: '1.2rem' }}>
          <div style={{ fontSize: '.8rem', color: 'var(--text-secondary)', marginBottom: '.2rem' }}>
            Ticket #{ticket.id}
          </div>
          <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700 }}>{ticket.asunto}</h2>
        </div>

        {/* Badges */}
        <div style={{ display: 'flex', gap: '.75rem', marginBottom: '1.2rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: '.65rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 1 }}>
              Estado
            </span>
            <span className={`badge badge-${ticket.estado}`} style={{ alignSelf: 'flex-start' }}>
              {ESTADO_LABEL[ticket.estado]}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: '.65rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 1 }}>
              Prioridad
            </span>
            <span className={`badge badge-${ticket.prioridad}`} style={{ alignSelf: 'flex-start', fontWeight: 700 }}>
              {ticket.prioridad.toUpperCase()}
            </span>
          </div>
        </div>

        {/* Metadata grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
          gap: '1rem',
          padding: '1rem',
          background: 'var(--bg)',
          borderRadius: 8,
          marginBottom: '1.5rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', fontSize: '.85rem' }}>
            <Building2 size={14} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: '.65rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Base</div>
              <div style={{ fontWeight: 600 }}>{ticket.base?.nombre || '—'}</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', fontSize: '.85rem' }}>
            <Settings2 size={14} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: '.65rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Sector</div>
              <div style={{ fontWeight: 600 }}>{ticket.sector?.nombre || '—'}</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', fontSize: '.85rem' }}>
            <MapPin size={14} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: '.65rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Ubicación</div>
              <div style={{ fontWeight: 600 }}>{ticket.ubicacion}</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', fontSize: '.85rem' }}>
            <Calendar size={14} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: '.65rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Fecha</div>
              <div style={{ fontWeight: 600 }}>{formatFecha(ticket.createdAt)}</div>
            </div>
          </div>
        </div>

        {/* Descripción */}
        <div style={{
          background: 'var(--bg)',
          borderRadius: 8,
          padding: '1rem',
          marginBottom: '1rem',
        }}>
          <div style={{ fontSize: '.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: '.4rem' }}>
            Descripción del problema
          </div>
          <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7, margin: 0, fontSize: '.95rem' }}>
            {ticket.descripcion}
          </p>
        </div>

        {/* Footer: reportó + técnico */}
        <div style={{ display: 'flex', gap: '2rem', fontSize: '.85rem', color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '.4rem' }}>
            <User size={14} />
            <span>Reportado por:</span>
            <span style={{ fontWeight: 600, color: 'var(--text)' }}>
              {ticket.usuario?.nombreCompleto || ticket.usuario?.telefono}
            </span>
          </div>
          {ticket.tecnicoAsignado && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '.4rem' }}>
              <UserCheck size={14} />
              <span>Técnico asignado:</span>
              <span style={{ fontWeight: 600, color: 'var(--text)' }}>{ticket.tecnicoAsignado}</span>
            </div>
          )}
        </div>
      </div>

      {/* ═══════════════════════════ Card: Acciones ═══════════════════════════ */}
      {user?.esAdmin && (
        <div className="card" style={{ marginBottom: '1.5rem', padding: '1.5rem 2rem' }}>
          <div style={{ fontSize: '.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: '1rem' }}>
            Acciones de administrador
          </div>

          {/* ─── superAdmin controls ─── */}
          {user?.superAdmin && (
            <div style={{
              display: 'flex', gap: '1.5rem', alignItems: 'flex-end', flexWrap: 'wrap',
              marginBottom: '1.2rem',
            }}>
              <div>
                <label style={{ fontWeight: 600, fontSize: '.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '.2rem' }}>
                  Estado
                </label>
                <select value={ticket.estado} onChange={e => patch({ estado: e.target.value })}>
                  <option value="abierto">Abierto</option>
                  <option value="en_proceso">En proceso</option>
                  <option value="cerrado">Cerrado</option>
                </select>
              </div>
              <div>
                <label style={{ fontWeight: 600, fontSize: '.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '.2rem' }}>
                  Prioridad
                </label>
                <select value={ticket.prioridad} onChange={e => patch({ prioridad: e.target.value })}>
                  <option value="baja">Baja</option>
                  <option value="media">Media</option>
                  <option value="alta">Alta</option>
                </select>
              </div>
              {!puedeActuar && (
                <div>
                  <label style={{ fontWeight: 600, fontSize: '.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '.2rem' }}>
                    Técnico
                  </label>
                  <select value={ticket.tecnicoAsignado || ''} onChange={e => patch({ tecnicoAsignado: e.target.value || null })}>
                    <option value="">— Sin asignar —</option>
                    {tecnicos.map(t => <option key={t.id} value={t.nombre}>{t.nombre}</option>)}
                  </select>
                </div>
              )}
            </div>
          )}

          {/* ─── Adoptar + Derivar ─── */}
          {puedeActuar && (
            <div style={{ display: 'flex', gap: '.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <button className="btn btn-primary" onClick={adoptar}>
                <ClipboardCheck size={18} /> Adoptar caso
              </button>
              {user?.superAdmin && (
                <>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '.85rem' }}>o</span>
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

          {/* ─── Cerrar ─── */}
          {puedeCerrar && (
            <div>
              <div className="form-group" style={{ marginBottom: '.75rem' }}>
                <label>Solución</label>
                <textarea
                  value={solucion}
                  onChange={e => setSolucion(e.target.value)}
                  placeholder="Describí cómo se resolvió el problema..."
                  rows={3}
                  style={{ width: '100%', padding: '.6rem', borderRadius: 6, border: '1px solid var(--border)', resize: 'vertical' }}
                />
              </div>
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

          {/* ─── Reabrir ─── */}
          {puedeReabrir && (
            <div style={{ marginTop: '.5rem' }}>
              <button className="btn btn-primary" onClick={() => patch({ estado: 'abierto' })}>
                <RotateCcw size={18} /> Reabrir ticket
              </button>
            </div>
          )}

          {/* ─── Dejar caso (técnico sin permiso de cerrar) ─── */}
          {soyElTecnico && ticket.estado === 'en_proceso' && !puedeCerrar && (
            <button className="btn btn-ghost" onClick={() => patch({ tecnicoAsignado: null, estado: 'abierto' })} style={{ color: 'var(--danger)' }}>
              <UserX size={18} /> Dejar caso
            </button>
          )}

          {/* ─── Sin acciones disponibles ─── */}
          {!puedeActuar && !puedeCerrar && !puedeReabrir && !soyElTecnico && !user?.superAdmin && (
            <p style={{ color: 'var(--text-secondary)', fontSize: '.85rem', textAlign: 'center', margin: 0 }}>
              {ticket.estado === 'cerrado'
                ? 'Este ticket está cerrado. Solo el administrador principal puede reabrirlo.'
                : 'Este ticket está en proceso. Solo el técnico asignado puede cerrarlo.'}
            </p>
          )}
        </div>
      )}

      {/* ═══════════════════════════ Card: Solución ═══════════════════════════ */}
      {ticket.solucion && (
        <div className="card" style={{ marginBottom: '1.5rem', background: '#f0fdf4', padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '.4rem', color: 'var(--success)', marginBottom: '.5rem' }}>
            <CircleCheckBig size={18} />
            <h3 style={{ margin: 0, fontSize: '1rem' }}>Solución</h3>
          </div>
          <p style={{ whiteSpace: 'pre-wrap', margin: 0, lineHeight: 1.7, fontSize: '.95rem' }}>{ticket.solucion}</p>
        </div>
      )}

      {/* ═══════════════════════════ Card: Historial ═══════════════════════════ */}
      {historial.length > 0 && (
        <div className="card" style={{ padding: '1.5rem' }}>
          <h3 style={{ margin: '0 0 1rem', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '.4rem' }}>
            <Clock size={16} style={{ color: 'var(--text-secondary)' }} /> Historial
          </h3>
          <div style={{ position: 'relative', paddingLeft: '1rem' }}>
            {/* Timeline line */}
            <div style={{
              position: 'absolute', left: 4, top: 4, bottom: 4,
              width: 2, background: 'var(--border)',
            }} />
            {historial.map((h, i) => {
              const color = colorHistorial(h.accion);
              const fecha = h.timestamp ? formatFecha(h.timestamp) : '';
              return (
                <div key={i} style={{
                  position: 'relative',
                  paddingLeft: '1.2rem',
                  paddingBottom: i < historial.length - 1 ? '1rem' : 0,
                }}>
                  {/* Timeline dot */}
                  <div style={{
                    position: 'absolute', left: -11, top: 3,
                    width: 20, height: 20, borderRadius: '50%',
                    background: 'var(--surface)',
                    border: `2px solid ${color}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color,
                  }}>
                    {iconoHistorial(h.accion)}
                  </div>

                  <div style={{ marginBottom: 2 }}>
                    <span style={{ fontWeight: 600, fontSize: '.9rem', color: 'var(--text)' }}>
                      {h.accion}
                    </span>
                  </div>
                  <div style={{ fontSize: '.8rem', color: 'var(--text-secondary)', display: 'flex', gap: '.4rem' }}>
                    {h.autor && <span>{h.autor}</span>}
                    {fecha && (
                      <>
                        <span style={{ opacity: .4 }}>·</span>
                        <span>{fecha}</span>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══════════════════════════ Card: Conversación WhatsApp ═══════════════════════════ */}
      {conversacion.length > 0 && (
        <div className="card" style={{ padding: '1.5rem' }}>
          <h3 style={{ margin: '0 0 1rem', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '.4rem' }}>
            <MessageCircle size={16} style={{ color: 'var(--success)' }} /> Conversación WhatsApp
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '.6rem' }}>
            {conversacion.map((m) => (
              <div key={m.id} style={{
                display: 'flex',
                justifyContent: m.direccion === 'inbound' ? 'flex-start' : 'flex-end',
              }}>
                <div style={{
                  maxWidth: '75%',
                  padding: '.6rem .9rem',
                  borderRadius: 12,
                  borderBottomRightRadius: m.direccion === 'outbound' ? 4 : undefined,
                  borderBottomLeftRadius: m.direccion === 'inbound' ? 4 : undefined,
                  background: m.direccion === 'inbound' ? '#e5e7eb' : '#dcfce7',
                  color: 'var(--text)',
                  fontSize: '.9rem',
                  lineHeight: 1.5,
                }}>
                  <div style={{ whiteSpace: 'pre-wrap' }}>{m.mensaje}</div>
                  <div style={{
                    fontSize: '.7rem',
                    color: 'var(--text-secondary)',
                    marginTop: '.3rem',
                    textAlign: m.direccion === 'inbound' ? 'left' : 'right',
                  }}>
                    {new Date(m.createdAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
