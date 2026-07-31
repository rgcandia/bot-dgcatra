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

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    try {
      const [secs, bs] = await Promise.all([
        api.get<SectorConBases[]>('/api/sectores'),
        api.get<Base[]>('/api/bases'),
      ]);
      setSectores(secs);
      setBases(bs);
    } finally { setLoading(false); }
  }

  async function handleSave() {
    if (!edit) return;
    try {
      if (edit.id) {
        await api.patch(`/api/sectores/${edit.id}`, { nombre: edit.nombre });
      } else {
        await api.post('/api/sectores', { nombre: edit.nombre });
      }
      setEdit(null); setShowNew(false);
      await loadAll();
    } catch (e: any) { alert(e.message); }
  }

  async function handleDelete(id: number) {
    if (!confirm('¿Eliminar este sector?')) return;
    try {
      await api.delete(`/api/sectores/${id}`);
      await loadAll();
    } catch (e: any) { alert(e.message); }
  }

  async function handleAsignar(baseId: number, sectorId: number) {
    try {
      await api.post('/api/sectores/asignar', { baseId, sectorId });
      await loadAll();
    } catch (e: any) { alert(e.message); }
  }

  if (loading) return <p>Cargando...</p>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2>Sectores</h2>
        <button className="btn btn-primary" onClick={() => { setEdit({ nombre: '' }); setShowNew(true); }}>
          Nuevo sector
        </button>
      </div>

      <table className="table">
        <thead>
          <tr><th>Nombre</th><th>Bases asignadas</th><th></th></tr>
        </thead>
        <tbody>
          {sectores.map(s => (
            <tr key={s.id}>
              <td>{s.nombre}</td>
              <td style={{ fontSize: '.85rem' }}>
                {(s.bases || []).map(b => (
                  <span key={b.id} className="badge" style={{ marginRight: 4, background: '#e2e8f0', padding: '2px 6px', borderRadius: 4 }}>{b.nombre}</span>
                ))}
                <button className="btn btn-ghost btn-sm" style={{ marginLeft: 4 }} onClick={() => setAsignar({ sectorId: s.id, nombre: s.nombre })}>+</button>
              </td>
              <td>
                <button className="btn btn-ghost btn-sm" onClick={() => setEdit(s)}>Editar</button>
                <button className="btn btn-ghost btn-sm" style={{ color: '#dc2626' }} onClick={() => handleDelete(s.id)}>Borrar</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {(edit || showNew) && (
        <div className="modal-overlay" onClick={() => { setEdit(null); setShowNew(false); }}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>{edit?.id ? 'Editar sector' : 'Nuevo sector'}</h3>
            <label>Nombre</label>
            <input className="input" value={edit?.nombre || ''} onChange={e => setEdit({ ...edit, nombre: e.target.value })} />
            <div style={{ marginTop: '1rem', display: 'flex', gap: '.5rem' }}>
              <button className="btn btn-primary" onClick={handleSave}>Guardar</button>
              <button className="btn btn-ghost" onClick={() => { setEdit(null); setShowNew(false); }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {asignar && (
        <div className="modal-overlay" onClick={() => setAsignar(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Asignar "{asignar.nombre}" a una base</h3>
            {bases.map(b => (
              <button key={b.id} className="btn btn-ghost" style={{ display: 'block', width: '100%', textAlign: 'left', marginBottom: 4 }}
                onClick={() => handleAsignar(b.id, asignar.sectorId)}>
                {b.nombre}
              </button>
            ))}
            <button className="btn btn-ghost" style={{ marginTop: '.5rem' }} onClick={() => setAsignar(null)}>Cancelar</button>
          </div>
        </div>
      )}
    </div>
  );
}
