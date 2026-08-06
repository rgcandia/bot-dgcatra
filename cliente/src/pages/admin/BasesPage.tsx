import { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { useSocket } from '../../context/useSocket';
import ConfirmButton from '../../components/ConfirmButton';

interface Base { id: number; nombre: string; codigoAcceso: string; }

export default function BasesPage() {
  const [bases, setBases] = useState<Base[]>([]);
  const [loading, setLoading] = useState(true);
  const [edit, setEdit] = useState<Partial<Base> | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [error, setError] = useState('');
  const { tick } = useSocket();

  useEffect(() => { load(); }, [tick]);

  async function load() {
    try { setBases(await api.get<Base[]>('/api/bases')); }
    finally { setLoading(false); }
  }

  async function handleSave() {
    if (!edit) return;
    setError('');
    try {
      if (edit.id) await api.patch(`/api/bases/${edit.id}`, { nombre: edit.nombre, codigoAcceso: edit.codigoAcceso });
      else await api.post('/api/bases', { nombre: edit.nombre, codigoAcceso: edit.codigoAcceso });
      setEdit(null); setShowNew(false);
      await load();
    } catch (e: any) { setError(e.message); }
  }

  async function handleDelete(id: number) {
    try { await api.delete(`/api/bases/${id}`); await load(); }
    catch (e: any) { setError(e.message); }
  }

  if (loading) return <p className="empty">Cargando...</p>;

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2>Bases</h2>
        <button className="btn btn-primary" onClick={() => { setEdit({ nombre: '', codigoAcceso: '' }); setShowNew(true); setError(''); }}>
          Nueva base
        </button>
      </div>

      <table>
        <thead><tr><th>Nombre</th><th>Código</th><th></th></tr></thead>
        <tbody>
          {bases.map(b => (
            <tr key={b.id}>
              <td>{b.nombre}</td>
              <td><code>{b.codigoAcceso}</code></td>
              <td>
                <button className="btn btn-ghost btn-sm" onClick={() => { setEdit(b); setError(''); }}>Editar</button>
                <ConfirmButton label="Borrar" danger message="¿Eliminar?" onConfirm={() => handleDelete(b.id)} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {(edit || showNew) && (
        <div className="modal-overlay" onClick={() => { setEdit(null); setShowNew(false); }}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>{edit?.id ? 'Editar base' : 'Nueva base'}</h3>
            {error && <p style={{ color: 'var(--danger)', marginBottom: '.5rem' }}>{error}</p>}
            <div className="form-group">
              <label>Nombre</label>
              <input className="input" value={edit?.nombre || ''} onChange={e => setEdit({ ...edit, nombre: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Código de acceso</label>
              <input className="input" value={edit?.codigoAcceso || ''} onChange={e => setEdit({ ...edit, codigoAcceso: e.target.value })} />
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
