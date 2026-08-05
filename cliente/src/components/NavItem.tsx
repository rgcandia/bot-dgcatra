import { NavLink } from 'react-router-dom';
import type { ReactNode } from 'react';

interface Props {
  to: string;
  icon: ReactNode;
  label: string;
  end?: boolean;
}

export default function NavItem({ to, icon, label, end }: Props) {
  return (
    <NavLink to={to} end={end} style={({ isActive }) => ({
      display: 'flex', alignItems: 'center', gap: '.6rem', padding: '.6rem 1rem',
      textDecoration: 'none', color: isActive ? 'var(--accent)' : 'var(--silver)',
      background: isActive ? 'rgba(182,255,24,.08)' : 'transparent',
      borderLeft: isActive ? '3px solid var(--accent)' : '3px solid transparent',
    })}>
      {icon} {label}
    </NavLink>
  );
}
