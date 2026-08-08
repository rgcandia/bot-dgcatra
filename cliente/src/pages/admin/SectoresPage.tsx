import { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { useSocket } from '../../context/useSocket';
import ConfirmButton from '../../components/ConfirmButton';

interface Sector { id: number; nombre: string; isAdmin: boolean; codigoAdmin: string | null; }

export default function SectoresPage() {
  const [sectores, setSectores] = useState<Sector[]>([]);
  const [loading, setLoading] = useState(true);
  const [edit, setEdit] = useState<Partial<Sector> | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [error, setError] = useState('');
  const { tick } = useSocket();

  useEffect(() => { load(); }, [tick]);

  async function load() {
    try { setSectores(await api.get<Sector[]>('/api/sectores')); }
    finally { setLoading(false); }
  }

  async function handleSave() {
    if (!edit) return;
    setError('');
    try {
      const body: Record<string, unknown> = { nombre: edit.nombre, isAdmin: edit.isAdmin, codigoAdmin: edit.codigoAdmin };
      if (edit.id) await api.patch(`/api/sectores/${edit.id}`, body);
      else await api.post('/api/sectores', body);
      setEdit(null); setShowNew(false);
      await load();
    } catch (e: any) { setError(e.message); }
  }

  async function handleDelete(id: number) {
    try { await api.delete(`/api/sectores/${id}`); await load(); }
    catch (e: any) { setError(e.message); }
  }

  if (loading) return <p className="empty">Cargando...</p>;

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2>Sectores</h2>
        <button className="btn btn-primary btn-sm" onClick={() => { setEdit({ nombre: '', isAdmin: false, codigoAdmin: '' }); setShowNew(true); setError(''); }}>
          Nuevo sector
        </button>
      </div>

      <table>
        <thead><tr><th>Nombre</th><th>Admin</th><th>Código</th><th></th></tr></thead>
        <tbody>
          {sectores.map(s => (
            <tr key={s.id}>
              <td>{s.nombre}</td>
              <td>{s.isAdmin ? <span className="badge badge-success">Sí</span> : <span className="badge">No</span>}</td>
              <td>{s.codigoAdmin || '-'}</td>
              <td>
                <button className="btn btn-ghost btn-sm" onClick={() => { setEdit(s); setError(''); }}>Editar</button>
                <ConfirmButton label="Borrar" danger message="¿Eliminar?" onConfirm={() => handleDelete(s.id)} />
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
            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: '.5rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={!!edit?.isAdmin}
                  onChange={e => setEdit({ ...edit, isAdmin: e.target.checked, codigoAdmin: e.target.checked ? (edit?.codigoAdmin || '') : '' })}
                />
                Sector administrador
              </label>
              <p style={{ color: 'var(--text-secondary)', fontSize: '.8rem', margin: '.2rem 0 0 1.7rem' }}>
                Los usuarios que elijan este sector deberán ingresar un código durante el registro.
              </p>
            </div>
            {edit?.isAdmin && (
              <div className="form-group">
                <label>Código de acceso</label>
                <input
                  className="input"
                  value={edit?.codigoAdmin || ''}
                  onChange={e => setEdit({ ...edit, codigoAdmin: e.target.value })}
                  placeholder="admin2024"
                />
              </div>
            )}
            <div style={{ display: 'flex', gap: '.5rem' }}>
              <button className="btn btn-primary btn-sm" onClick={handleSave}>Guardar</button>
              <button className="btn btn-ghost btn-sm" onClick={() => { setEdit(null); setShowNew(false); }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
