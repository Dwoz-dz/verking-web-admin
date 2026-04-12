import React from 'react';
import { useTheme } from '../context/ThemeContext';

interface SpinnerProps { size?: 'sm' | 'md' | 'lg'; color?: string; fullPage?: boolean; }

export function Spinner({ size = 'md', color, fullPage = false }: SpinnerProps) {
  const { theme } = useTheme();
  const c = color || theme.primary_color;
  const sizes = { sm: 'w-5 h-5', md: 'w-8 h-8', lg: 'w-12 h-12' };

  const spinner = (
    <div
      className={`${sizes[size]} rounded-full animate-spin`}
      style={{ border: `3px solid ${c}20`, borderTopColor: c }}
    />
  );

  if (fullPage) return (
    <div className="min-h-[50vh] flex items-center justify-center">{spinner}</div>
  );
  return spinner;
}

export function AdminSpinner() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 rounded-full animate-spin" style={{ border: '3px solid #1A3C6E20', borderTopColor: '#1A3C6E' }} />
    </div>
  );
}
