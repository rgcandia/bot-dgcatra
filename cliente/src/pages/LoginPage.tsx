import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [showMaster, setShowMaster] = useState(false);
  const { login, verify, loading } = useAuth();
  const navigate = useNavigate();

  async function handlePhone(e: FormEvent) {
    e.preventDefault(); setError(''); setMessage('');
    if (phone.length < 8) { setError('Ingresá un número válido'); return; }
    try {
      const msg = await login(phone);
      setMessage(msg);
      setStep('code');
    } catch (err: any) { setError(err.message); }
  }

  async function handleCode(e: FormEvent) {
    e.preventDefault(); setError('');
    if (code.length < 4) { setError('Código inválido'); return; }
    try {
      await verify(phone, code);
      navigate('/', { replace: true });
    } catch (err: any) { setError(err.message); }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="card" style={{ width: 380 }}>
        <h1 style={{ marginBottom: 4, fontSize: '1.5rem' }}>DG Catra</h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>Panel de gestión</p>
        {step === 'phone' ? (
          <form onSubmit={handlePhone}>
            <div className="form-group">
              <label>Teléfono (sin 15, sin 0)</label>
              <input value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g,''))} placeholder="1166086509" autoFocus />
            </div>
            {error && <p style={{ color: 'var(--danger)', marginBottom: '1rem' }}>{error}</p>}
            <button className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
              {loading ? 'Enviando...' : 'Solicitar código'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleCode}>
            <p style={{ marginBottom: '.5rem', color: 'var(--text-secondary)' }}>
              📱 Te enviamos un código de 6 dígitos a tu WhatsApp <strong>{phone}</strong>
            </p>
            {message && <p style={{ color: 'var(--primary)', marginBottom: '1rem', fontSize: '.85rem' }}>{message}</p>}
            <div className="form-group">
              <label>Código</label>
              <input value={code} onChange={e => setCode(e.target.value.replace(/\D/g,'').slice(0,6))} placeholder="123456" autoFocus />
            </div>
            {error && <p style={{ color: 'var(--danger)', marginBottom: '1rem' }}>{error}</p>}
            <button className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
              {loading ? 'Verificando...' : 'Ingresar'}
            </button>
            <div style={{ marginTop: '1rem', fontSize: '.85rem', textAlign: 'center' }}>
              {!showMaster ? (
                <button type="button" className="btn btn-ghost" style={{ fontSize: '.8rem' }}
                  onClick={() => setShowMaster(true)}>
                  ¿No recibiste el código? Usá código de acceso
                </button>
              ) : (
                <span style={{ color: 'var(--text-secondary)' }}>
                  Ingresá el código maestro en el campo de arriba
                  <br />
                  <button type="button" className="btn btn-ghost" style={{ fontSize: '.75rem', marginTop: '.25rem' }}
                    onClick={() => { setShowMaster(false); setCode(''); }}>
                    Volver a código SMS
                  </button>
                </span>
              )}
            </div>
            <button type="button" className="btn btn-ghost" style={{ width: '100%', marginTop: '.5rem' }}
              onClick={() => { setStep('phone'); setError(''); setMessage(''); setShowMaster(false); }}>
              Cambiar número
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
