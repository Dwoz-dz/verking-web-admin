import React from 'react';
import { Package, Edit2, Copy } from 'lucide-react';
import { useAdminUI } from '../../../context/AdminUIContext';
import { Product, Category } from './types';
import { StockBadge } from './ProductRowComponents';

interface ProductGridProps {
  filtered: Product[];
  categories: Category[];
  isDark: boolean;
  openEdit: (p: Product) => void;
  handleDuplicate: (p: Product) => void;
}

export function ProductGrid({ filtered, categories, isDark, openEdit, handleDuplicate }: ProductGridProps) {
  const { t } = useAdminUI();

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
      {filtered.map(p => {
        const cat = categories.find(c => c.id === p.category_id);
        return (
          <div key={p.id} className={`${t.card} border ${t.cardBorder} rounded-2xl overflow-hidden hover:shadow-md transition-all group ${!p.is_active ? 'opacity-60' : ''}`}>
            <div className="relative aspect-square">
              {p.images?.[0]
                ? <img src={p.images[0]} alt="" className="w-full h-full object-cover" />
                : <div className={`w-full h-full flex items-center justify-center ${isDark ? 'bg-gray-800' : 'bg-gray-50'}`}><Package size={32} className={t.textMuted} /></div>}
              {!p.is_active && <div className="absolute inset-0 bg-black/40 flex items-center justify-center"><span className="text-white text-xs font-bold">INACTIF</span></div>}
              <div className="absolute top-2 left-2 flex gap-1 flex-wrap">
                {p.is_featured && <span className="px-1.5 py-0.5 bg-blue-600 text-white text-[9px] font-bold rounded-md">⭐</span>}
                {p.is_new && <span className="px-1.5 py-0.5 bg-purple-600 text-white text-[9px] font-bold rounded-md">NEW</span>}
                {p.is_promo && <span className="px-1.5 py-0.5 bg-red-500 text-white text-[9px] font-bold rounded-md">PROMO</span>}
              </div>
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100 gap-1.5">
                <button onClick={() => openEdit(p)} className="p-2 bg-white rounded-lg shadow-md hover:bg-blue-50 transition-colors"><Edit2 size={14} className="text-[#1A3C6E]" /></button>
                <button onClick={() => handleDuplicate(p)} className="p-2 bg-white rounded-lg shadow-md hover:bg-gray-50 transition-colors"><Copy size={14} className="text-gray-600" /></button>
              </div>
            </div>
            <div className="p-3">
              <div className={`font-semibold text-xs ${t.text} truncate`}>{p.name_fr}</div>
              {cat && <div className={`text-[10px] ${t.textMuted} mt-0.5`}>{cat.name_fr}</div>}
              <div className="flex items-center justify-between mt-2">
                <div className={`font-black text-sm ${t.text}`}>{(p.sale_price || p.price).toLocaleString()} <span className={`text-xs font-normal ${t.textMuted}`}>DA</span></div>
                <StockBadge stock={p.stock} threshold={p.low_stock_threshold} />
              </div>
            </div>
          </div>
        );
      })}
      {filtered.length === 0 && (
        <div className={`col-span-full py-20 text-center ${t.textMuted}`}>
          <Package size={40} className="mx-auto mb-3 opacity-20" />
          <p>Aucun produit trouvé</p>
        </div>
      )}
    </div>
  );
}
