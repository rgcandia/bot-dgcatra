import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const API = import.meta.env.VITE_API_URL || '';

interface Ticket {
  id: number;
  asunto: string;
  descripcion: string;
  ubicacion: string;
  estado: string;
  prioridad: string;
  tecnicoAsignado: string | null;
  solucion: string | null;
  historial: any[];
  createdAt: string;
  usuario: { nombreCompleto: string; telefono: string };
  base: { nombre: string };
  sector: { nombre: string } | null;
}

export default function TicketDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [solucion, setSolucion] = useState('');

  useEffect(() => {
    fetch(`${API}/api/tickets/${id}`, {
      headers: { Authorization: `Bearer ${user?.token}` },
    })
      .then(r => r.json())
      .then(setTicket)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  async function adoptar() {
    const nombre = user?.nombre || user?.telefono || '';
    await fetch(`${API}/api/tickets/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user?.token}` },
      body: JSON.stringify({ estado: 'en_proceso', tecnicoAsignado: nombre }),
    });
    window.location.reload();
  }

  async function cerrar() {
    if (!solucion.trim()) return;
    await fetch(`${API}/api/tickets/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user?.token}` },
      body: JSON.stringify({ estado: 'cerrado', solucion: solucion.trim() }),
    });
    window.location.reload();
  }

  if (loading) return <p className="empty">Cargando...</p>;
  if (!ticket) return <p className="empty">Ticket no encontrado</p>;

  const puedeAdoptar = user?.esAdmin && ticket.estado === 'abierto';
  const puedeCerrar = user?.esAdmin && ticket.estado === 'en_proceso';
  const historial: any[] = Array.isArray(ticket.historial) ? ticket.historial : [];

  return (
    <div style={{ maxWidth: 800 }}>
      <button className="btn btn-ghost btn-sm" onClick={() => navigate('/')} style={{ marginBottom: '1rem' }}>
        ← Volver
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
            <span style={{
              background: ticket.prioridad === 'alta' ? '#fef2f2' : ticket.prioridad === 'media' ? '#fff7ed' : '#f9fafb',
              color: ticket.prioridad === 'alta' ? '#dc2626' : ticket.prioridad === 'media' ? '#e76f51' : '#6b7280',
              padding: '.2rem .5rem', borderRadius: 4, fontSize: '.75rem', fontWeight: 600,
            }}>
              {ticket.prioridad.toUpperCase()}
            </span>
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

      {puedeAdoptar && (
        <div className="card" style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '.8rem' }}>Nadie tomó este caso todavía</p>
          <button className="btn btn-primary" onClick={adoptar}>
            📋 Adoptar caso
          </button>
        </div>
      )}

      {puedeCerrar && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ margin: '0 0 .8rem' }}>Cerrar ticket</h3>
          <textarea
            value={solucion}
            onChange={e => setSolucion(e.target.value)}
            placeholder="Describí la solución..."
            rows={3}
            style={{ width: '100%', padding: '.6rem', borderRadius: 6, border: '1px solid var(--border)', resize: 'vertical' }}
          />
          <button className="btn btn-primary" style={{ marginTop: '.6rem' }} onClick={cerrar} disabled={!solucion.trim()}>
            ✅ Cerrar ticket
          </button>
        </div>
      )}

      {ticket.solucion && (
        <div className="card" style={{ marginBottom: '1.5rem', background: '#f0fdf4' }}>
          <h3 style={{ margin: '0 0 .5rem', color: '#16a34a' }}>✅ Solución</h3>
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
