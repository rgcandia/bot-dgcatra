import { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { useSocket } from '../../context/useSocket';
import ConfirmButton from '../../components/ConfirmButton';

type Tipo = 'base' | 'playa' | 'comuna';

interface Base { id: number; nombre: string; direccion: string; codigoAcceso: string; tipo: Tipo; }

const TIPOS: { value: Tipo; label: string }[] = [
  { value: 'base', label: 'Base' },
  { value: 'playa', label: 'Playa' },
  { value: 'comuna', label: 'Comuna' },
];

const TIPO_LABEL: Record<Tipo, string> = { base: 'Base', playa: 'Playa', comuna: 'Comuna' };

export default function BasesPage() {
  const [bases, setBases] = useState<Base[]>([]);
  const [loading, setLoading] = useState(true);
  const [edit, setEdit] = useState<Partial<Base> | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [error, setError] = useState('');
  const [filtroTipo, setFiltroTipo] = useState<Tipo | 'todas'>('todas');
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
      const payload = { nombre: edit.nombre, direccion: edit.direccion, codigoAcceso: edit.codigoAcceso, tipo: edit.tipo };
      if (edit.id) await api.patch(`/api/bases/${edit.id}`, payload);
      else await api.post('/api/bases', payload);
      setEdit(null); setShowNew(false);
      await load();
    } catch (e: any) { setError(e.message); }
  }

  async function handleDelete(id: number) {
    try { await api.delete(`/api/bases/${id}`); await load(); }
    catch (e: any) { setError(e.message); }
  }

  if (loading) return <p className="empty">Cargando...</p>;

  const visibles = filtroTipo === 'todas' ? bases : bases.filter(b => b.tipo === filtroTipo);

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2>Establecimientos</h2>
        <button className="btn btn-primary btn-sm" onClick={() => { setEdit({ nombre: '', direccion: '', codigoAcceso: '', tipo: 'base' }); setShowNew(true); setError(''); }}>
          Nuevo establecimiento
        </button>
      </div>

      <div style={{ display: 'flex', gap: '.5rem', marginBottom: '1rem' }}>
        {(['todas', 'base', 'playa', 'comuna'] as const).map(t => (
          <button
            key={t}
            className="btn btn-sm"
            onClick={() => setFiltroTipo(t)}
            style={{
              background: filtroTipo === t ? 'var(--primary)' : 'var(--surface)',
              color: filtroTipo === t ? '#fff' : 'var(--text)',
              border: '1px solid var(--border)',
            }}
          >
            {t === 'todas' ? 'Todas' : TIPO_LABEL[t]}
          </button>
        ))}
      </div>

      <table>
        <thead><tr><th>Nombre</th><th>Tipo</th><th>Dirección</th><th>Código</th><th></th></tr></thead>
        <tbody>
          {visibles.map(b => (
            <tr key={b.id}>
              <td>{b.nombre}</td>
              <td><span className={`badge badge-${b.tipo}`}>{TIPO_LABEL[b.tipo]}</span></td>
              <td>{b.direccion}</td>
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
            <h3>{edit?.id ? 'Editar establecimiento' : 'Nuevo establecimiento'}</h3>
            {error && <p style={{ color: 'var(--danger)', marginBottom: '.5rem' }}>{error}</p>}
            <div className="form-group">
              <label>Nombre</label>
              <input className="input" value={edit?.nombre || ''} onChange={e => setEdit({ ...edit, nombre: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Tipo</label>
              <select className="input" value={edit?.tipo || 'base'} onChange={e => setEdit({ ...edit, tipo: e.target.value as Tipo })}>
                {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Dirección</label>
              <input className="input" value={edit?.direccion || ''} onChange={e => setEdit({ ...edit, direccion: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Código de acceso</label>
              <input className="input" value={edit?.codigoAcceso || ''} onChange={e => setEdit({ ...edit, codigoAcceso: e.target.value })} />
            </div>
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
