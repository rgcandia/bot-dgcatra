import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [error, setError] = useState('');
  const { login, verify, loading } = useAuth();
  const navigate = useNavigate();

  async function handlePhone(e: FormEvent) {
    e.preventDefault(); setError('');
    if (!/^\d{10,15}$/.test(phone)) { setError('Ingresá un número válido (código país + número)'); return; }
    try {
      await login(phone);
      setStep('code');
    } catch { setError('Número no registrado'); }
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
              <label>WhatsApp (código país + número)</label>
              <input value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g,''))} placeholder="5491123456789" autoFocus />
            </div>
            {error && <p style={{ color: 'var(--danger)', marginBottom: '1rem' }}>{error}</p>}
            <button className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
              {loading ? 'Enviando...' : 'Solicitar código'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleCode}>
            <p style={{ marginBottom: '1rem', color: 'var(--text-secondary)' }}>
              Te enviamos un código a <strong>{phone}</strong>
            </p>
            <div className="form-group">
              <label>Código de 6 dígitos</label>
              <input value={code} onChange={e => setCode(e.target.value.replace(/\D/g,'').slice(0,6))} placeholder="123456" autoFocus />
            </div>
            {error && <p style={{ color: 'var(--danger)', marginBottom: '1rem' }}>{error}</p>}
            <button className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
              {loading ? 'Verificando...' : 'Ingresar'}
            </button>
            <button type="button" className="btn btn-ghost" style={{ width: '100%', marginTop: '.5rem' }} onClick={() => { setStep('phone'); setError(''); }}>
              Cambiar número
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
