import { useState, useEffect, useRef } from 'react';
import { ShieldCheck, CheckCircle, AlertTriangle } from 'lucide-react';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { io, Socket } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_API_URL || '';

export default function SettingsPage() {
  const { user } = useAuth();
  const [masterCode, setMasterCode] = useState('');
  const [masterDigits, setMasterDigits] = useState(['', '', '', '', '', '']);
  const masterRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [savedMaster, setSavedMaster] = useState(false);
  const [botConnected, setBotConnected] = useState<boolean | null>(null);
  const [botPhone, setBotPhone] = useState('');
  const [qrCode, setQrCode] = useState('');
  const [askingUnlink, setAskingUnlink] = useState(false);
  const [unlinkError, setUnlinkError] = useState('');
  const [waitingQR, setWaitingQR] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => {
    api.get<{ masterCode: string }>('/api/settings/master-code')
      .then((d) => {
        setMasterCode(d.masterCode);
        const digits = (d.masterCode || '').padEnd(6, '').slice(0, 6).split('');
        setMasterDigits(digits);
      })
      .catch(() => {});

    if (!user?.token) return;
    const socket: Socket = io(SOCKET_URL, { auth: { token: user.token }, transports: ['websocket', 'polling'] });

    socket.on('bot-status', (status: { connected: boolean; phone?: string }) => {
      setBotConnected(status.connected);
      setBotPhone(status.phone || '');
      if (status.connected) { setQrCode(''); setWaitingQR(false); }
      else setWaitingQR(true);
    });

    socket.on('bot-qr', (qr: string) => {
      setQrCode(qr);
      setBotConnected(false);
      setWaitingQR(false);
    });

    return () => { socket.disconnect(); };
  }, [user?.token]);

  function handleMasterDigit(index: number, value: string) {
    const digit = value.replace(/\D/g, '').slice(0, 1);
    const newDigits = [...masterDigits];
    newDigits[index] = digit;
    setMasterDigits(newDigits);
    if (digit && index < 5) masterRefs.current[index + 1]?.focus();
  }

  function handleMasterKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === 'Backspace' && !masterDigits[index] && index > 0) {
      masterRefs.current[index - 1]?.focus();
    }
  }

  function handleMasterPaste(e: React.ClipboardEvent) {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length > 0) {
      const digits = pasted.padEnd(6, '').split('');
      setMasterDigits(digits);
      masterRefs.current[Math.min(pasted.length, 5)]?.focus();
    }
  }

  async function saveMaster() {
    const codigo = masterDigits.join('');
    await api.patch('/api/settings/master-code', { masterCode: codigo });
    setMasterCode(codigo);
    setSavedMaster(true);
    setTimeout(() => setSavedMaster(false), 2000);
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 4000);
  }

  return (
    <div>
      <h2 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '.5rem' }}>
        <ShieldCheck size={22} />
        Configuración
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', maxWidth: 520 }}>

        <div className="card" style={{ padding: '1.5rem' }}>
          <h3 style={{ margin: '0 0 1rem' }}>Estado del Bot</h3>
          {botConnected === null ? (
            <p style={{ color: 'var(--text-secondary)', fontSize: '.9rem', marginBottom: '.8rem' }}>
              <span className="spinner spinner-sm" style={{ marginRight: 6, verticalAlign: 'middle' }} />
              Conectando con el servidor...
            </p>
          ) : (
            <div style={{ marginBottom: '.8rem' }}>
              {botConnected ? (
                <p style={{ color: 'var(--success)', fontWeight: 600, margin: '0 0 .5rem', display: 'flex', alignItems: 'center', gap: '.35rem' }}>
                  <CheckCircle size={16} />
                  Conectado {botPhone && <span style={{ fontWeight: 400 }}>({botPhone})</span>}
                </p>
              ) : (
                <p style={{ color: 'var(--danger)', fontWeight: 600, margin: '0 0 .5rem', display: 'flex', alignItems: 'center', gap: '.35rem' }}>
                  <AlertTriangle size={16} />
                  Desconectado
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
                setWaitingQR(true);
                setBotConnected(false);
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

          {!botConnected && !qrCode && waitingQR && (
            <p style={{ color: 'var(--text-secondary)', fontSize: '.85rem', marginTop: '.5rem' }}>
              <span className="spinner spinner-sm" style={{ marginRight: 6, verticalAlign: 'middle' }} />
              Generando código QR...
            </p>
          )}
        </div>

        <div className="card" style={{ padding: '1.5rem' }}>
          <div className="form-group" style={{ marginBottom: '0' }}>
            <label>Código maestro de acceso</label>
            <p style={{ color: 'var(--text-secondary)', fontSize: '.85rem', margin: '.5rem 0 1rem' }}>
              Backup para loguearse al dashboard si no llega el OTP por WhatsApp.
            </p>
            <div style={{ display: 'flex', gap: '.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: '.35rem' }}>
                {masterDigits.map((d, i) => (
                  <input
                    key={i}
                    ref={el => masterRefs.current[i] = el}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={d}
                    onChange={e => handleMasterDigit(i, e.target.value)}
                    onKeyDown={e => handleMasterKeyDown(i, e)}
                    onPaste={i === 0 ? handleMasterPaste : undefined}
                    style={{
                      width: 40, height: 40, textAlign: 'center',
                      fontSize: '1.1rem', fontWeight: 700, padding: 0,
                      borderRadius: 6, border: `1.5px solid ${d ? 'var(--primary)' : 'var(--border)'}`,
                      outline: 'none', background: d ? '#f0f9ff' : 'var(--surface)',
                    }}
                  />
                ))}
              </div>
              <button className="btn btn-primary btn-sm" onClick={saveMaster}>{savedMaster ? 'Guardado' : 'Guardar'}</button>
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: '1.5rem', border: '1px solid var(--danger)' }}>
          <h3 style={{ margin: '0 0 .5rem', color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '.35rem' }}>
            <AlertTriangle size={18} />
            Zona de peligro
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '.85rem', marginBottom: '1rem' }}>
            Estas acciones son irreversibles. Eliminan datos masivamente.
          </p>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <MassDeleteButton label="Eliminar todos los tickets" endpoint="/api/stats/tickets" id="del-tickets" onDone={showToast} />
            <MassDeleteButton label="Eliminar usuarios no-admin" endpoint="/api/stats/usuarios" id="del-usuarios" onDone={showToast} />
          </div>
        </div>

      </div>

      {toast && (
        <div onClick={() => setToast('')} style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
          background: '#1A2C3F', color: '#B6FF18', padding: '.8rem 1.2rem',
          borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,.3)', cursor: 'pointer',
          maxWidth: 360, display: 'flex', alignItems: 'center', gap: '.5rem',
        }}>
          <CheckCircle size={16} />
          {toast}
        </div>
      )}
    </div>
  );
}

function MassDeleteButton({ label, endpoint, id, onDone }: { label: string; endpoint: string; id: string; onDone: (msg: string) => void }) {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [oculto, setOculto] = useState(false);

  useEffect(() => {
    const handler = (e: CustomEvent) => setOculto(!!e.detail && e.detail !== id);
    window.addEventListener('mass-delete-active', handler as any);
    return () => window.removeEventListener('mass-delete-active', handler as any);
  }, [id]);

  async function ejecutar() {
    setLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || ''}${endpoint}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${JSON.parse(localStorage.getItem('dgcatra_auth') || '{}').token}` },
      });
      const data = await res.json();
      if (data.ok) onDone(data.mensaje);
    } catch { onDone('Error de conexión'); }
    finally { setLoading(false); setStep(0); window.dispatchEvent(new CustomEvent('mass-delete-active', { detail: null })); }
  }

  function iniciar() { setStep(1); window.dispatchEvent(new CustomEvent('mass-delete-active', { detail: id })); }
  function cancelar() { setStep(0); window.dispatchEvent(new CustomEvent('mass-delete-active', { detail: null })); }

  return (
    <div style={{ display: oculto ? 'none' : 'block' }}>
      {step === 0 && (
        <button className="btn btn-danger btn-sm" onClick={iniciar}>{label}</button>
      )}
      {step === 1 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
          <span style={{ fontSize: '.85rem', color: 'var(--danger)' }}>¿Confirmás?</span>
          <button className="btn btn-danger btn-sm" onClick={ejecutar} disabled={loading}>
            {loading ? <span className="spinner spinner-sm" /> : 'Sí, eliminar'}
          </button>
          <button className="btn btn-ghost btn-sm" onClick={cancelar}>No</button>
        </div>
      )}
    </div>
  );
}
