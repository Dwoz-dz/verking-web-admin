import React from 'react';
import { XCircle, AlertTriangle, CheckCircle } from 'lucide-react';

export function Toggle({ value, onChange }: { value: boolean; onChange: () => void }) {
  return (
    <button type="button" onClick={onChange}
      className={`relative w-11 h-6 rounded-full transition-all duration-200 shrink-0 ${value ? 'bg-[#1A3C6E]' : 'bg-gray-200'}`}>
      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-all duration-200 ${value ? 'left-6' : 'left-1'}`} />
    </button>
  );
}

export function StockBadge({ stock, threshold = 5 }: { stock: number; threshold?: number }) {
  if (stock === 0) return (
    <span className="flex items-center gap-1 px-2 py-0.5 bg-red-50 text-red-600 rounded-lg text-xs font-bold border border-red-100">
      <XCircle size={10} /> Épuisé
    </span>
  );
  if (stock <= threshold) return (
    <span className="flex items-center gap-1 px-2 py-0.5 bg-orange-50 text-orange-600 rounded-lg text-xs font-bold border border-orange-100">
      <AlertTriangle size={10} /> Faible ({stock})
    </span>
  );
  return (
    <span className="flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-600 rounded-lg text-xs font-bold border border-green-100">
      <CheckCircle size={10} /> {stock}
    </span>
  );
}

export function Badge({ color, icon: Icon, label }: { color: 'blue' | 'purple' | 'orange' | 'red' | 'green'; icon: React.ComponentType<{ size?: number; className?: string }>; label: string }) {
  const colors = {
    blue: 'bg-blue-50 text-blue-700 border-blue-100',
    purple: 'bg-purple-50 text-purple-700 border-purple-100',
    orange: 'bg-orange-50 text-orange-700 border-orange-100',
    red: 'bg-red-50 text-red-700 border-red-100',
    green: 'bg-green-50 text-green-700 border-green-100',
  };
  return (
    <span className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-bold border ${colors[color]}`}>
      <Icon size={8} /> {label}
    </span>
  );
}

export function PlacementDot({ active }: { active: boolean }) {
  return <div className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-[#1A3C6E]' : 'bg-gray-200'}`} />;
}
