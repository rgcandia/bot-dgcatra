import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { MessageCircle, ShieldCheck } from 'lucide-react';

interface AdminInfo { id: string; nombre: string; }

export default function LoginPage() {
  const [admins, setAdmins] = useState<AdminInfo[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [selectedNombre, setSelectedNombre] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'select' | 'code' | 'master'>('select');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [sending, setSending] = useState(false);
  const { fetchAdmins, login, verify, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetchAdmins().then(list => { setAdmins(list); setLoaded(true); });
  }, [fetchAdmins]);

  async function handleSelectAdmin(admin: AdminInfo) {
    setSelectedId(admin.id);
    setSelectedNombre(admin.nombre);
    setError(''); setMessage('');
    setSending(true);
    try {
      const msg = await login(admin.id);
      setMessage(msg);
      setStep('code');
    } catch (err: any) { setError(err.message); }
    finally { setSending(false); }
  }

  function handleSelectChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const admin = admins.find(a => a.id === e.target.value);
    if (admin) handleSelectAdmin(admin);
  }

  async function handleCode(e: FormEvent) {
    e.preventDefault(); setError('');
    if (code.length < 4) { setError('Código inválido'); return; }
    try {
      if (step === 'master') {
        await verify('master', code);
      } else {
        await verify(selectedId, code);
      }
      navigate('/', { replace: true });
    } catch (err: any) { setError(err.message); }
  }

  if (!loaded) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#1A2C3F' }}>
      <span className="spinner" />
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1A2C3F' }}>
      <div className="card" style={{ width: 400, padding: '2rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
          <img src="/logo-small.png"
            alt="GCBA" style={{ width: 100, height: 'auto' }} />
        </div>
        <h1 style={{ marginBottom: 2, fontSize: '1.4rem', textAlign: 'center', fontWeight: 800, letterSpacing: 4, color: '#1A2C3F' }}>DGCATRA</h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', textAlign: 'center' }}>Sistema de Gestión de Tickets</p>

        {step === 'select' && (
          <div>
            {admins.length > 0 ? (
              <>
                <p style={{ marginBottom: '.5rem', fontWeight: 500 }}>Seleccioná tu usuario:</p>
                <select
                  value={selectedId}
                  onChange={handleSelectChange}
                  disabled={sending}
                  style={{ width: '100%', padding: '.6rem', borderRadius: 6, border: '1px solid var(--border)', marginBottom: '.5rem', fontSize: '.95rem' }}
                >
                  <option value="">-- Elegir --</option>
                  {admins.map(a => (
                    <option key={a.id} value={a.id}>{a.nombre}</option>
                  ))}
                </select>
                {sending && (
                  <p style={{ color: '#1A2C3F', fontSize: '.85rem', textAlign: 'center', marginBottom: '.5rem' }}>
                    <span className="spinner" style={{ marginRight: 6, verticalAlign: 'middle' }} /> Enviando código...
                  </p>
                )}
                <button type="button" className="btn btn-ghost" style={{ width: '100%', fontSize: '.8rem', marginTop: '.25rem' }}
                  onClick={() => { setStep('master'); setCode(''); }}
                  disabled={sending}>
                  Usar código maestro
                </button>
              </>
            ) : (
              <>
                <p style={{ marginBottom: '1rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
                  No hay administradores registrados.
                </p>
                <button className="btn btn-primary" style={{ width: '100%' }}
                  onClick={() => setStep('master')}>
                  Ingresar código maestro
                </button>
              </>
            )}
            {error && <p style={{ color: 'var(--danger)', marginTop: '1rem', textAlign: 'center' }}>{error}</p>}
          </div>
        )}

        {(step === 'code' || step === 'master') && (
          <form onSubmit={handleCode}>
            {step === 'code' ? (
              <p style={{ marginBottom: '.5rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
                <MessageCircle size={14} style={{ marginBottom: -2, marginRight: 4 }} /> Código enviado a <strong>{selectedNombre}</strong>
              </p>
            ) : (
              <p style={{ marginBottom: '.5rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
                <ShieldCheck size={14} style={{ marginBottom: -2, marginRight: 4 }} /> Ingresá el código maestro de acceso
              </p>
            )}
            {message && <p style={{ color: '#1A2C3F', marginBottom: '1rem', fontSize: '.85rem', textAlign: 'center' }}>{message}</p>}
            <div className="form-group">
              <label>Código</label>
              <input value={code} onChange={e => setCode(e.target.value.replace(/\D/g,'').slice(0,6))} placeholder="123456" autoFocus />
            </div>
            {error && <p style={{ color: 'var(--danger)', marginBottom: '1rem', textAlign: 'center' }}>{error}</p>}
            <button className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
              {loading ? 'Verificando...' : 'Ingresar'}
            </button>
            <button type="button" className="btn btn-ghost" style={{ width: '100%', marginTop: '.5rem' }}
              onClick={() => { setStep('select'); setError(''); setMessage(''); setCode(''); }}>
              Volver
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
