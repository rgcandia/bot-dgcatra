import { useState, useEffect } from 'react';
import { api } from '../../api/client';

interface User {
  telefono: string;
  nombreCompleto: string | null;
  email: string | null;
  base: { nombre: string } | null;
  sector: { nombre: string } | null;
  registroCompleto: boolean;
  esAdmin: boolean;
  activo: boolean;
}

interface Base { id: number; nombre: string; }

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [edit, setEdit] = useState<User | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      setUsuarios(await api.get<User[]>('/api/usuarios'));
    } finally { setLoading(false); }
  }

  async function handleSave() {
    if (!edit) return;
    try {
      await api.patch(`/api/usuarios/${edit.telefono}`, {
        nombreCompleto: edit.nombreCompleto,
        email: edit.email,
        esAdmin: edit.esAdmin,
        activo: edit.activo,
      });
      setEdit(null);
      await load();
    } catch (e: any) { alert(e.message); }
  }

  if (loading) return <p>Cargando...</p>;

  return (
    <div>
      <h2 style={{ marginBottom: '1rem' }}>Usuarios ({usuarios.length})</h2>

      <table className="table">
        <thead>
          <tr><th>Teléfono</th><th>Nombre</th><th>Base</th><th>Sector</th><th>Registro</th><th>Admin</th><th></th></tr>
        </thead>
        <tbody>
          {usuarios.map(u => (
            <tr key={u.telefono}>
              <td>{u.telefono}</td>
              <td>{u.nombreCompleto || '-'}</td>
              <td>{u.base?.nombre || '-'}</td>
              <td>{u.sector?.nombre || '-'}</td>
              <td>{u.registroCompleto ? '✅' : '⏳'}</td>
              <td>{u.esAdmin ? '🔑' : '-'}</td>
              <td>
                <button className="btn btn-ghost btn-sm" onClick={() => setEdit(u)}>Editar</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {edit && (
        <div className="modal-overlay" onClick={() => setEdit(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Editar {edit.telefono}</h3>

            <label>Nombre</label>
            <input className="input" value={edit.nombreCompleto || ''} onChange={e => setEdit({ ...edit, nombreCompleto: e.target.value })} />

            <label>Email</label>
            <input className="input" value={edit.email || ''} onChange={e => setEdit({ ...edit, email: e.target.value })} />

            <label style={{ display: 'flex', alignItems: 'center', gap: '.5rem', marginTop: '.5rem' }}>
              <input type="checkbox" checked={edit.esAdmin} onChange={e => setEdit({ ...edit, esAdmin: e.target.checked })} />
              Es administrador
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
              <input type="checkbox" checked={edit.activo} onChange={e => setEdit({ ...edit, activo: e.target.checked })} />
              Activo
            </label>

            <div style={{ marginTop: '1rem', display: 'flex', gap: '.5rem' }}>
              <button className="btn btn-primary" onClick={handleSave}>Guardar</button>
              <button className="btn btn-ghost" onClick={() => setEdit(null)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
