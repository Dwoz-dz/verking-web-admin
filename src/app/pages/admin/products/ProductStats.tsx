import React from 'react';
import { Package, CheckCircle, Star, AlertTriangle, XCircle } from 'lucide-react';
import { useAdminUI } from '../../../context/AdminUIContext';

interface ProductStatsProps {
  stats: {
    total: number;
    active: number;
    lowStock: number;
    outOfStock: number;
    featured: number;
  };
}

export function ProductStats({ stats }: ProductStatsProps) {
  const { isDark, t } = useAdminUI();
  
  const items = [
    { label: 'Total', value: stats.total, icon: Package, color: 'text-[#1A3C6E]', bg: isDark ? 'bg-blue-900/20' : 'bg-blue-50' },
    { label: 'Actifs', value: stats.active, icon: CheckCircle, color: 'text-green-600', bg: isDark ? 'bg-green-900/20' : 'bg-green-50' },
    { label: 'En vedette', value: stats.featured, icon: Star, color: 'text-yellow-600', bg: isDark ? 'bg-yellow-900/20' : 'bg-yellow-50' },
    { label: 'Stock faible', value: stats.lowStock, icon: AlertTriangle, color: 'text-orange-600', bg: isDark ? 'bg-orange-900/20' : 'bg-orange-50' },
    { label: 'Épuisés', value: stats.outOfStock, icon: XCircle, color: 'text-red-600', bg: isDark ? 'bg-red-900/20' : 'bg-red-50' },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
      {items.map(s => (
        <div key={s.label} className={`${t.card} border ${t.cardBorder} rounded-2xl p-4 flex items-center gap-3`}>
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${s.bg}`}>
            <s.icon size={16} className={s.color} />
          </div>
          <div>
            <div className={`text-xl font-black ${t.text}`}>{s.value}</div>
            <div className={`text-xs ${t.textMuted}`}>{s.label}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
