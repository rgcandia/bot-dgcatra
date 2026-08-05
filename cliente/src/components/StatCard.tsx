interface Props {
  value: number;
  label: string;
  color?: string;
}

export default function StatCard({ value, label, color }: Props) {
  return (
    <div className="card" style={{ padding: '1rem', textAlign: 'center' }}>
      <div style={{ fontSize: '2rem', fontWeight: 700, color: color || 'inherit' }}>{value}</div>
      <div style={{ color: 'var(--text-secondary)', fontSize: '.85rem' }}>{label}</div>
    </div>
  );
}
