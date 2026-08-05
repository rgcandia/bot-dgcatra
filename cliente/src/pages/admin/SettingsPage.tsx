import { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { io, Socket } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_API_URL || '';

export default function SettingsPage() {
  const { user } = useAuth();
  const [masterCode, setMasterCode] = useState('');
  const [adminCode, setAdminCode] = useState('');
  const [savedMaster, setSavedMaster] = useState(false);
  const [savedAdmin, setSavedAdmin] = useState(false);
  const [botConnected, setBotConnected] = useState<boolean | null>(null);
  const [botPhone, setBotPhone] = useState('');
  const [qrCode, setQrCode] = useState('');
  const [askingUnlink, setAskingUnlink] = useState(false);
  const [unlinkError, setUnlinkError] = useState('');

  useEffect(() => {
    api.get<{ masterCode: string; adminCode: string }>('/api/settings/master-code')
      .then((d) => { setMasterCode(d.masterCode); setAdminCode(d.adminCode); })
      .catch(() => {});

    if (!user?.token) return;
    const socket: Socket = io(SOCKET_URL, { auth: { token: user.token }, transports: ['websocket', 'polling'] });

    socket.on('bot-status', (status: { connected: boolean; phone?: string }) => {
      setBotConnected(status.connected);
      setBotPhone(status.phone || '');
      if (status.connected) setQrCode('');
    });

    socket.on('bot-qr', (qr: string) => {
      setQrCode(qr);
      setBotConnected(false);
    });

    return () => { socket.disconnect(); };
  }, [user?.token]);

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
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', maxWidth: 520 }}>

        <div className="card" style={{ padding: '1.5rem' }}>
          <h3 style={{ margin: '0 0 1rem' }}>Estado del Bot</h3>
          {botConnected !== null && (
            <div style={{ marginBottom: '.8rem' }}>
              {botConnected ? (
                <p style={{ color: 'var(--success)', fontWeight: 600, margin: '0 0 .5rem' }}>
                  ✅ Conectado {botPhone && `(${botPhone})`}
                </p>
              ) : (
                <p style={{ color: 'var(--danger)', fontWeight: 600, margin: '0 0 .5rem' }}>
                  ⚠️ Desconectado
                </p>
              )}
            </div>
          )}
          {botConnected && !askingUnlink && (
            <button className="btn btn-danger btn-sm" style={{ marginTop: '.5rem', marginBottom: '.5rem' }}
              onClick={() => setAskingUnlink(true)}>
              Desvincular WhatsApp
            </button>
          )}
          {askingUnlink && (
            <div style={{ marginTop: '.5rem', marginBottom: '.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
                <span style={{ fontSize: '.85rem', color: 'var(--text-secondary)' }}>¿Desvincular? Se pedirá QR nuevo.</span>
                <button className="btn btn-danger btn-sm" onClick={async () => {
                  setUnlinkError('');
                  try {
                    await api.post('/api/settings/logout-whatsapp');
                  } catch (e: any) {
                    setUnlinkError(e.message);
                  }
                  setAskingUnlink(false);
                }}>Sí</button>
                <button className="btn btn-ghost btn-sm" onClick={() => setAskingUnlink(false)}>No</button>
              </div>
              {unlinkError && <p style={{ color: 'var(--danger)', fontSize: '.85rem', marginTop: '.3rem' }}>{unlinkError}</p>}
            </div>
          )}

          {qrCode && (
            <div style={{ textAlign: 'center', marginTop: '1rem' }}>
              <p style={{ fontSize: '.85rem', marginBottom: '.8rem', color: 'var(--text-secondary)' }}>
                Escaneá el QR para reconectar:
              </p>
              <img src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(qrCode)}`}
                alt="QR Code" style={{ border: '1px solid var(--border)', borderRadius: 8 }} />
            </div>
          )}
        </div>

        <div className="card" style={{ padding: '1.5rem' }}>
          <div className="form-group" style={{ marginBottom: '0' }}>
            <label>Código maestro de acceso</label>
            <p style={{ color: 'var(--text-secondary)', fontSize: '.85rem', margin: '.5rem 0 1rem' }}>
              Backup para loguearse al dashboard si no llega el OTP por WhatsApp.
            </p>
            <div style={{ display: 'flex', gap: '.5rem' }}>
              <input value={masterCode} onChange={e => setMasterCode(e.target.value)} placeholder="abc123" style={{ flex: 1 }} />
              <button className="btn btn-primary" onClick={saveMaster}>{savedMaster ? '✓' : 'Guardar'}</button>
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: '1.5rem' }}>
          <div className="form-group" style={{ marginBottom: '0' }}>
            <label>Código de autorización Admin</label>
            <p style={{ color: 'var(--text-secondary)', fontSize: '.85rem', margin: '.5rem 0 1rem' }}>
              Se pide al usuario durante el registro por WhatsApp si selecciona sector "Soporte Técnico".
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
