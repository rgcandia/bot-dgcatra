import { useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import { api } from '../../api/client';

interface User {
  telefono: string; nombreCompleto: string | null; email: string | null;
  base: { id: number; nombre: string } | null; sector: { id: number; nombre: string } | null;
  baseId?: number | null; sectorId?: number | null;
  registroCompleto: boolean; esAdmin: boolean; activo: boolean;
}

interface Base { id: number; nombre: string; }
interface Sector { id: number; nombre: string; }

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState<User[]>([]);
  const [bases, setBases] = useState<Base[]>([]);
  const [sectores, setSectores] = useState<Sector[]>([]);
  const [loading, setLoading] = useState(true);
  const [edit, setEdit] = useState<User | null>(null);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const [users, bs, secs] = await Promise.all([
        api.get<User[]>('/api/usuarios'),
        api.get<Base[]>('/api/bases'),
        api.get<Sector[]>('/api/sectores'),
      ]);
      setUsuarios(users); setBases(bs); setSectores(secs);
    } finally { setLoading(false); }
  }

  async function handleSave() {
    if (!edit) return;
    setError('');
    try {
      await api.patch(`/api/usuarios/${edit.telefono}`, {
        nombreCompleto: edit.nombreCompleto, email: edit.email,
        esAdmin: edit.esAdmin, activo: edit.activo,
        baseId: edit.baseId, sectorId: edit.sectorId,
      });
      setEdit(null); await load();
    } catch (e: any) { setError(e.message); }
  }

  const filtrados = usuarios.filter(u => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (u.nombreCompleto || '').toLowerCase().includes(q)
      || u.telefono.includes(q)
      || (u.base?.nombre || '').toLowerCase().includes(q)
      || (u.sector?.nombre || '').toLowerCase().includes(q);
  });

  if (loading) return <p className="empty">Cargando...</p>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2>Usuarios ({usuarios.length})</h2>
        <div style={{ position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
          <input
            placeholder="Buscar..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ padding: '.5rem .5rem .5rem 2rem', borderRadius: 6, border: '1px solid var(--border)', width: 220, fontSize: '.9rem' }}
          />
        </div>
      </div>

      <table>
        <thead><tr><th>ID WhatsApp</th><th>Nombre</th><th>Base</th><th>Sector</th><th>Registro</th><th>Admin</th><th></th></tr></thead>
        <tbody>
          {filtrados.map(u => (
            <tr key={u.telefono}>
              <td style={{ fontFamily: 'monospace', fontSize: '.85rem' }}>{u.telefono}</td>
              <td>{u.nombreCompleto || '-'}</td>
              <td>{u.base?.nombre || '-'}</td>
              <td>{u.sector?.nombre || '-'}</td>
              <td>
                <span className={`badge ${u.registroCompleto ? 'badge-cerrado' : 'badge-en_proceso'}`}>
                  {u.registroCompleto ? 'Completo' : 'Pendiente'}
                </span>
              </td>
              <td>{u.esAdmin ? 'true' : 'false'}</td>
              <td>
                <button className="btn btn-ghost btn-sm" onClick={() => { setEdit(u); setError(''); }}>Editar</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {edit && (
        <div className="modal-overlay" onClick={() => setEdit(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Editar {edit.telefono}</h3>
            {error && <p style={{ color: 'var(--danger)', marginBottom: '.5rem' }}>{error}</p>}

            <div className="form-group">
              <label>Nombre</label>
              <input className="input" value={edit.nombreCompleto || ''} onChange={e => setEdit({ ...edit, nombreCompleto: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input className="input" value={edit.email || ''} onChange={e => setEdit({ ...edit, email: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Base</label>
              <select value={edit.base?.id || edit.baseId || ''} onChange={e => setEdit({ ...edit, baseId: Number(e.target.value) || null })}>
                <option value="">Sin base</option>
                {bases.map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Sector</label>
              <select value={edit.sector?.id || edit.sectorId || ''} onChange={e => setEdit({ ...edit, sectorId: Number(e.target.value) || null })}>
                <option value="">Sin sector</option>
                {sectores.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
              </select>
            </div>
            <div style={{ marginTop: '.5rem', marginBottom: '1rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '.4rem', marginBottom: '.3rem', cursor: 'pointer', fontWeight: 400 }}>
                <input type="checkbox" checked={edit.esAdmin} onChange={e => setEdit({ ...edit, esAdmin: e.target.checked })} />
                Es administrador
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '.4rem', cursor: 'pointer', fontWeight: 400 }}>
                <input type="checkbox" checked={edit.activo} onChange={e => setEdit({ ...edit, activo: e.target.checked })} />
                Activo
              </label>
            </div>
            <div style={{ display: 'flex', gap: '.5rem' }}>
              <button className="btn btn-primary" onClick={handleSave}>Guardar</button>
              <button className="btn btn-ghost" onClick={() => setEdit(null)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
