import { useState, useEffect } from 'react';
import { api } from '../../api/client';

export default function SettingsPage() {
  const [code, setCode] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.get<{ masterCode: string }>('/api/settings/master-code')
      .then((d: { masterCode: string }) => setCode(d.masterCode))
      .catch(() => {});
  }, []);

  async function handleSave() {
    await api.patch('/api/settings/master-code', { masterCode: code });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div>
      <h2 style={{ marginBottom: '1.5rem' }}>🔐 Configuración</h2>
      <div className="card" style={{ maxWidth: 480 }}>
        <div className="form-group">
          <label>Código maestro de acceso</label>
          <p style={{ color: 'var(--text-secondary)', fontSize: '.85rem', marginBottom: '.5rem' }}>
            Código de backup para acceder al dashboard si no llega el OTP por WhatsApp.
          </p>
          <div style={{ display: 'flex', gap: '.5rem' }}>
            <input
              value={code}
              onChange={e => setCode(e.target.value)}
              placeholder="Ej: abc123"
              style={{ flex: 1 }}
            />
            <button className="btn btn-primary" onClick={handleSave}>
              {saved ? '✓ Guardado' : 'Guardar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
