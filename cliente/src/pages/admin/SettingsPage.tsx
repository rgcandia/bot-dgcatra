import { useState, useEffect } from 'react';
import { api } from '../../api/client';

export default function SettingsPage() {
  const [masterCode, setMasterCode] = useState('');
  const [adminCode, setAdminCode] = useState('');
  const [savedMaster, setSavedMaster] = useState(false);
  const [savedAdmin, setSavedAdmin] = useState(false);

  useEffect(() => {
    api.get<{ masterCode: string; adminCode: string }>('/api/settings/master-code')
      .then((d) => { setMasterCode(d.masterCode); setAdminCode(d.adminCode); })
      .catch(() => {});
  }, []);

  async function saveMaster() {
    await api.patch('/api/settings/master-code', { masterCode });
    setSavedMaster(true);
    setTimeout(() => setSavedMaster(false), 2000);
  }

  async function saveAdmin() {
    await api.patch('/api/settings/admin-code', { adminCode });
    setSavedAdmin(true);
    setTimeout(() => setSavedAdmin(false), 2000);
  }

  return (
    <div>
      <h2 style={{ marginBottom: '1.5rem' }}>🔐 Configuración</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: 480 }}>

        <div className="card">
          <div className="form-group">
            <label>Código maestro de acceso</label>
            <p style={{ color: 'var(--text-secondary)', fontSize: '.85rem', marginBottom: '.5rem' }}>
              Backup para loguearse al dashboard si no llega el OTP por WhatsApp.
            </p>
            <div style={{ display: 'flex', gap: '.5rem' }}>
              <input value={masterCode} onChange={e => setMasterCode(e.target.value)} placeholder="abc123" style={{ flex: 1 }} />
              <button className="btn btn-primary" onClick={saveMaster}>{savedMaster ? '✓' : 'Guardar'}</button>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="form-group">
            <label>Código de autorización Admin</label>
            <p style={{ color: 'var(--text-secondary)', fontSize: '.85rem', marginBottom: '.5rem' }}>
              Se pide al usuario durante el registro por WhatsApp si selecciona rol "Admin".
            </p>
            <div style={{ display: 'flex', gap: '.5rem' }}>
              <input value={adminCode} onChange={e => setAdminCode(e.target.value)} placeholder="admin2024" style={{ flex: 1 }} />
              <button className="btn btn-primary" onClick={saveAdmin}>{savedAdmin ? '✓' : 'Guardar'}</button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
