import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

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
  const { fetchAdmins, login, verify, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetchAdmins().then(list => { setAdmins(list); setLoaded(true); });
  }, [fetchAdmins]);

  async function handleSelectAdmin(admin: AdminInfo) {
    setSelectedId(admin.id);
    setSelectedNombre(admin.nombre);
    setError(''); setMessage('');
    try {
      const msg = await login(admin.id);
      setMessage(msg);
      setStep('code');
    } catch (err: any) { setError(err.message); }
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

  if (!loaded) return <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center' }}>Cargando...</div>;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="card" style={{ width: 380 }}>
        <h1 style={{ marginBottom: 4, fontSize: '1.5rem' }}>DG Catra</h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>Panel de gestión</p>

        {step === 'select' && (
          <div>
            {admins.length > 0 ? (
              <>
                <p style={{ marginBottom: '1rem' }}>Seleccioná tu usuario:</p>
                {admins.map(a => (
                  <button key={a.id} className="btn btn-primary" style={{ width: '100%', marginBottom: '.5rem' }}
                    onClick={() => handleSelectAdmin(a)} disabled={loading}>
                    {a.nombre}
                  </button>
                ))}
                <button type="button" className="btn btn-ghost" style={{ width: '100%', fontSize: '.8rem', marginTop: '.5rem' }}
                  onClick={() => { setStep('master'); setCode(''); }}>
                  Usar código maestro
                </button>
              </>
            ) : (
              <>
                <p style={{ marginBottom: '1rem', color: 'var(--text-secondary)' }}>
                  No hay administradores registrados. Ingresá el código maestro.
                </p>
                <button className="btn btn-primary" style={{ width: '100%' }}
                  onClick={() => setStep('master')}>
                  Ingresar código maestro
                </button>
              </>
            )}
            {error && <p style={{ color: 'var(--danger)', marginTop: '1rem' }}>{error}</p>}
          </div>
        )}

        {(step === 'code' || step === 'master') && (
          <form onSubmit={handleCode}>
            {step === 'code' ? (
              <p style={{ marginBottom: '.5rem', color: 'var(--text-secondary)' }}>
                📱 Código enviado a <strong>{selectedNombre}</strong>
              </p>
            ) : (
              <p style={{ marginBottom: '.5rem', color: 'var(--text-secondary)' }}>
                🔐 Ingresá el código maestro de acceso
              </p>
            )}
            {message && <p style={{ color: 'var(--primary)', marginBottom: '1rem', fontSize: '.85rem' }}>{message}</p>}
            <div className="form-group">
              <label>Código</label>
              <input value={code} onChange={e => setCode(e.target.value.replace(/\D/g,'').slice(0,6))} placeholder="123456" autoFocus />
            </div>
            {error && <p style={{ color: 'var(--danger)', marginBottom: '1rem' }}>{error}</p>}
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
