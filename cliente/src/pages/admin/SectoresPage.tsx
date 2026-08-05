import { useState, useEffect } from 'react';
import { api } from '../../api/client';

interface Sector { id: number; nombre: string; }
interface Base { id: number; nombre: string; }
interface SectorConBases extends Sector { bases: Base[]; }

export default function SectoresPage() {
  const [sectores, setSectores] = useState<SectorConBases[]>([]);
  const [bases, setBases] = useState<Base[]>([]);
  const [loading, setLoading] = useState(true);
  const [edit, setEdit] = useState<Partial<Sector> | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [asignar, setAsignar] = useState<{ sectorId: number; nombre: string } | null>(null);
  const [baseId, setBaseId] = useState('');
  const [error, setError] = useState('');

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    try {
      const [secs, bs] = await Promise.all([api.get<SectorConBases[]>('/api/sectores'), api.get<Base[]>('/api/bases')]);
      setSectores(secs); setBases(bs);
    } finally { setLoading(false); }
  }

  async function handleSave() {
    if (!edit) return;
    setError('');
    try {
      if (edit.id) await api.patch(`/api/sectores/${edit.id}`, { nombre: edit.nombre });
      else await api.post('/api/sectores', { nombre: edit.nombre });
      setEdit(null); setShowNew(false);
      await loadAll();
    } catch (e: any) { setError(e.message); }
  }

  async function handleDelete(id: number) {
    if (!confirm('¿Eliminar este sector?')) return;
    try { await api.delete(`/api/sectores/${id}`); await loadAll(); }
    catch (e: any) { setError(e.message); }
  }

  async function handleAsignar() {
    if (!asignar || !baseId) return;
    setError('');
    try {
      await api.post('/api/sectores/asignar', { baseId: Number(baseId), sectorId: asignar.sectorId });
      await loadAll(); setAsignar(null); setBaseId('');
    } catch (e: any) { setError(e.message); }
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
        <thead><tr><th>Nombre</th><th>Bases asignadas</th><th></th></tr></thead>
        <tbody>
          {sectores.map(s => (
            <tr key={s.id}>
              <td>{s.nombre}</td>
              <td>
                {(s.bases || []).map(b => (
                  <span key={b.id} style={{ display:'inline-block', background:'var(--bg)', padding:'2px 8px', borderRadius:4, marginRight:4, fontSize:'.85rem' }}>
                    {b.nombre}
                  </span>
                ))}
                <button className="btn btn-ghost btn-sm" style={{ marginLeft: 4 }}
                  onClick={() => { setAsignar({ sectorId: s.id, nombre: s.nombre }); setBaseId(''); setError(''); }}>+</button>
              </td>
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

      {asignar && (
        <div className="modal-overlay" onClick={() => setAsignar(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Asignar "{asignar.nombre}"</h3>
            {error && <p style={{ color: 'var(--danger)', marginBottom: '.5rem' }}>{error}</p>}
            <div className="form-group">
              <select value={baseId} onChange={e => setBaseId(e.target.value)} style={{ width:'100%', padding:'.5rem', borderRadius:6, border:'1px solid var(--border)' }}>
                <option value="">Seleccionar base...</option>
                {bases.map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', gap: '.5rem' }}>
              <button className="btn btn-primary" onClick={handleAsignar} disabled={!baseId}>Asignar</button>
              <button className="btn btn-ghost" onClick={() => setAsignar(null)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
