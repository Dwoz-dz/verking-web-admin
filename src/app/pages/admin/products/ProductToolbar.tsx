import React from 'react';
import { Search, SlidersHorizontal, ArrowUp, ArrowDown, List, LayoutGrid } from 'lucide-react';
import { useAdminUI } from '../../../context/AdminUIContext';
import { Category, FilterStatus, FilterStock, SortField, ViewMode } from './types';

interface ProductToolbarProps {
  search: string;
  setSearch: (v: string) => void;
  filterCat: string;
  setFilterCat: (v: string) => void;
  filterStatus: FilterStatus;
  setFilterStatus: (v: FilterStatus) => void;
  showFilters: boolean;
  setShowFilters: React.Dispatch<React.SetStateAction<boolean>>;
  sortField: SortField;
  setSortField: (v: SortField) => void;
  sortDir: 'asc' | 'desc';
  setSortDir: React.Dispatch<React.SetStateAction<'asc' | 'desc'>>;
  viewMode: ViewMode;
  setViewMode: (v: ViewMode) => void;
  categories: Category[];
  filterBadge: string;
  setFilterBadge: (v: string) => void;
  filterStock: FilterStock;
  setFilterStock: (v: FilterStock) => void;
}

export function ProductToolbar(props: ProductToolbarProps) {
  const { t, isDark } = useAdminUI();
  const {
    search, setSearch, filterCat, setFilterCat, filterStatus, setFilterStatus,
    showFilters, setShowFilters, sortField, setSortField, sortDir, setSortDir,
    viewMode, setViewMode, categories, filterBadge, setFilterBadge, filterStock, setFilterStock
  } = props;

  return (
    <div className={`${t.card} border ${t.cardBorder} rounded-2xl p-3`}>
      <div className="flex gap-2 flex-wrap items-center">
        {/* Search */}
        <div className="relative flex-1 min-w-48">
          <Search size={14} className={`absolute left-3 top-1/2 -translate-y-1/2 ${t.textMuted}`} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher produits, SKU..."
            className={`pl-9 pr-4 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40 w-full ${t.input}`} />
        </div>

        {/* Category */}
        <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
          className={`px-3 py-2.5 border rounded-xl text-sm focus:outline-none ${t.input}`}>
          <option value="">Toutes catégories</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name_fr}</option>)}
        </select>

        {/* Status */}
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as FilterStatus)}
          className={`px-3 py-2.5 border rounded-xl text-sm focus:outline-none ${t.input}`}>
          <option value="all">Tout statut</option>
          <option value="active">Actifs</option>
          <option value="inactive">Inactifs</option>
        </select>

        {/* Advanced filters toggle */}
        <button onClick={() => setShowFilters((v: boolean) => !v)}
          className={`flex items-center gap-2 px-3 py-2.5 border rounded-xl text-sm font-medium transition-colors ${showFilters ? 'bg-[#1A3C6E] text-white border-[#1A3C6E]' : `${t.input} ${t.rowHover}`}`}>
          <SlidersHorizontal size={14} />
          Filtres {showFilters && '▾'}
        </button>

        <div className="ml-auto flex items-center gap-2">
          {/* Sort */}
          <select value={sortField} onChange={e => setSortField(e.target.value as SortField)}
            className={`px-3 py-2.5 border rounded-xl text-sm focus:outline-none ${t.input}`}>
            <option value="sort_order">Ordre</option>
            <option value="name">Nom</option>
            <option value="price">Prix</option>
            <option value="stock">Stock</option>
            <option value="updated">Modifié</option>
          </select>

          <button onClick={() => setSortDir((d: string) => d === 'asc' ? 'desc' : 'asc')}
            className={`p-2.5 border rounded-xl transition-colors ${t.input} ${t.rowHover}`}>
            {sortDir === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
          </button>

          {/* View toggle */}
          <div className={`flex border rounded-xl overflow-hidden ${t.cardBorder}`}>
            <button onClick={() => setViewMode('table')}
              className={`p-2.5 transition-colors ${viewMode === 'table' ? 'bg-[#1A3C6E] text-white' : `${t.card} ${t.rowHover} ${t.textMuted}`}`}>
              <List size={14} />
            </button>
            <button onClick={() => setViewMode('grid')}
              className={`p-2.5 transition-colors ${viewMode === 'grid' ? 'bg-[#1A3C6E] text-white' : `${t.card} ${t.rowHover} ${t.textMuted}`}`}>
              <LayoutGrid size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Advanced filters */}
      {showFilters && (
        <div className={`mt-3 pt-3 border-t ${t.divider} flex gap-2 flex-wrap items-center`}>
          <span className={`text-xs font-semibold ${t.textMuted} uppercase tracking-wider`}>Badges:</span>
          {[
            { val: '', label: 'Tous' },
            { val: 'featured', label: '⭐ Vedette' },
            { val: 'new', label: '✨ Nouveau' },
            { val: 'best_seller', label: '🔥 Top' },
            { val: 'promo', label: '🏷️ Promo' },
            { val: 'homepage', label: '🏠 Accueil' },
            { val: 'cartables', label: '🎒 Cartables' },
            { val: 'trousses', label: '📝 Trousses' },
          ].map(f => (
            <button key={f.val} onClick={() => setFilterBadge(f.val)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${filterBadge === f.val ? 'bg-[#1A3C6E] text-white border-[#1A3C6E]' : `${t.card} ${t.cardBorder} ${t.textMuted} ${t.rowHover}`}`}>
              {f.label}
            </button>
          ))}
          <span className={`ml-4 text-xs font-semibold ${t.textMuted} uppercase tracking-wider`}>Stock:</span>
          {[
            { val: 'all', label: 'Tout' },
            { val: 'low', label: '⚠️ Faible' },
            { val: 'out', label: '❌ Épuisé' },
          ].map(f => (
            <button key={f.val} onClick={() => setFilterStock(f.val as FilterStock)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${filterStock === f.val ? 'bg-orange-500 text-white border-orange-500' : `${t.card} ${t.cardBorder} ${t.textMuted} ${t.rowHover}`}`}>
              {f.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
