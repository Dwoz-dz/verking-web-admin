import React from 'react';
import { X } from 'lucide-react';
import { Category } from './types';

interface ProductBulkActionsProps {
  selectedCount: number;
  clearSelected: () => void;
  bulkAction: (action: string, extra?: any) => Promise<void> | void;
  categories: Category[];
}

export function ProductBulkActions({ selectedCount, clearSelected, bulkAction, categories }: ProductBulkActionsProps) {
  if (selectedCount === 0) return null;

  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl border-2 border-[#1A3C6E]/30 bg-[#1A3C6E]/5`}>
      <button onClick={clearSelected} className="p-1 hover:opacity-70 transition-opacity">
        <X size={14} className="text-[#1A3C6E]" />
      </button>
      <span className="text-sm font-bold text-[#1A3C6E]">{selectedCount} sélectionné(s)</span>
      <div className="flex gap-2 flex-wrap ml-2">
        <button onClick={() => bulkAction('activate')} className="px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-xs font-semibold hover:bg-green-200 transition-colors">✅ Activer</button>
        <button onClick={() => bulkAction('deactivate')} className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs font-semibold hover:bg-gray-200 transition-colors">🚫 Désactiver</button>
        <button onClick={() => bulkAction('feature')} className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg text-xs font-semibold hover:bg-blue-200 transition-colors">⭐ Vedette</button>
        <button onClick={() => bulkAction('section_homepage')} className="px-3 py-1.5 bg-purple-100 text-purple-700 rounded-lg text-xs font-semibold hover:bg-purple-200 transition-colors">🏠 Accueil</button>
        {/* Category bulk */}
        <div className="relative" onClick={e => e.stopPropagation()}>
          <select className="px-3 py-1.5 bg-yellow-50 text-yellow-800 rounded-lg text-xs font-semibold border border-yellow-200 cursor-pointer"
            onChange={e => { if (e.target.value) bulkAction('category', e.target.value); e.target.value = ''; }}>
            <option value="">📂 Catégorie...</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name_fr}</option>)}
          </select>
        </div>
        <button onClick={() => { if (confirm(`Supprimer ${selectedCount} produit(s) ?`)) bulkAction('delete'); }}
          className="px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-xs font-semibold hover:bg-red-200 transition-colors">🗑️ Supprimer</button>
      </div>
    </div>
  );
}
