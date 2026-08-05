import { useState, useEffect } from 'react';
import { api } from '../../api/client';

interface Sector { id: number; nombre: string; }

export default function SectoresPage() {
  const [sectores, setSectores] = useState<Sector[]>([]);
  const [loading, setLoading] = useState(true);
  const [edit, setEdit] = useState<Partial<Sector> | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    try { setSectores(await api.get<Sector[]>('/api/sectores')); }
    finally { setLoading(false); }
  }

  async function handleSave() {
    if (!edit) return;
    setError('');
    try {
      if (edit.id) await api.patch(`/api/sectores/${edit.id}`, { nombre: edit.nombre });
      else await api.post('/api/sectores', { nombre: edit.nombre });
      setEdit(null); setShowNew(false);
      await load();
    } catch (e: any) { setError(e.message); }
  }

  async function handleDelete(id: number) {
    if (!confirm('¿Eliminar este sector?')) return;
    try { await api.delete(`/api/sectores/${id}`); await load(); }
    catch (e: any) { setError(e.message); }
  }

  if (loading) return <p className="empty">Cargando...</p>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2>Sectores</h2>
        <button className="btn btn-primary" onClick={() => { setEdit({ nombre: '' }); setShowNew(true); setError(''); }}>
          Nuevo sector
        </button>
      </div>

      <table>
        <thead><tr><th>Nombre</th><th></th></tr></thead>
        <tbody>
          {sectores.map(s => (
            <tr key={s.id}>
              <td>{s.nombre}</td>
              <td>
                <button className="btn btn-ghost btn-sm" onClick={() => { setEdit(s); setError(''); }}>Editar</button>
                <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => handleDelete(s.id)}>Borrar</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {(edit || showNew) && (
        <div className="modal-overlay" onClick={() => { setEdit(null); setShowNew(false); }}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>{edit?.id ? 'Editar sector' : 'Nuevo sector'}</h3>
            {error && <p style={{ color: 'var(--danger)', marginBottom: '.5rem' }}>{error}</p>}
            <div className="form-group">
              <label>Nombre</label>
              <input className="input" value={edit?.nombre || ''} onChange={e => setEdit({ ...edit, nombre: e.target.value })} />
            </div>
            <div style={{ display: 'flex', gap: '.5rem' }}>
              <button className="btn btn-primary" onClick={handleSave}>Guardar</button>
              <button className="btn btn-ghost" onClick={() => { setEdit(null); setShowNew(false); }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
