import { useState } from 'react';

interface Props {
  onConfirm: () => void;
  message: string;
  label: string;
  danger?: boolean;
}

export default function ConfirmButton({ onConfirm, message, label, danger }: Props) {
  const [asking, setAsking] = useState(false);

  if (!asking) {
    return <button className="btn btn-ghost btn-sm" style={danger ? { color: 'var(--danger)' } : {}}
      onClick={() => setAsking(true)}>{label}</button>;
  }

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '.4rem', fontSize: '.85rem' }}>
      <span style={{ color: 'var(--text-secondary)' }}>{message}</span>
      <button className="btn btn-danger btn-sm" onClick={() => { onConfirm(); setAsking(false); }}>Sí</button>
      <button className="btn btn-ghost btn-sm" onClick={() => setAsking(false)}>No</button>
    </span>
  );
}
