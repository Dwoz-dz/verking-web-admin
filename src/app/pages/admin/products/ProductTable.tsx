import React from 'react';
import { 
  CheckSquare, Square, ArrowUpDown, Package, Star, Edit2, 
  MoreHorizontal, Copy, Eye, EyeOff, Trash2, Monitor, Smartphone 
} from 'lucide-react';
import { useAdminUI } from '../../../context/AdminUIContext';
import { Product, Category, SortField } from './types';
import { StockBadge, Badge, PlacementDot } from './ProductRowComponents';

interface ProductTableProps {
  products: Product[];
  filtered: Product[];
  categories: Category[];
  selected: Set<string>;
  toggleAll: () => void;
  toggleSelect: (id: string) => void;
  toggleSort: (field: SortField) => void;
  toggleActive: (p: Product) => void;
  toggleFeatured: (p: Product) => void;
  openEdit: (p: Product) => void;
  handleDuplicate: (p: Product) => void;
  handleDelete: (id: string, name: string) => void;
  quickActionMenu: string | null;
  setQuickActionMenu: (id: string | null) => void;
}

export function ProductTable(props: ProductTableProps) {
  const { isDark, t } = useAdminUI();
  const {
    products, filtered, categories, selected, toggleAll, toggleSelect,
    toggleSort, toggleActive, toggleFeatured, openEdit, handleDuplicate,
    handleDelete, quickActionMenu, setQuickActionMenu
  } = props;

  return (
    <div className={`${t.card} border ${t.cardBorder} rounded-2xl shadow-sm overflow-hidden`}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className={`${t.thead} text-xs ${t.theadText} uppercase tracking-wider border-b ${t.cardBorder}`}>
            <tr>
              <th className="px-4 py-3 w-10">
                <button onClick={toggleAll} className={t.textMuted}>
                  {selected.size === filtered.length && filtered.length > 0
                    ? <CheckSquare size={15} className="text-[#1A3C6E]" />
                    : <Square size={15} />}
                </button>
              </th>
              <th className="text-start px-4 py-3">
                <button onClick={() => toggleSort('name')} className={`flex items-center gap-1 hover:${t.text} transition-colors`}>
                  Produit <ArrowUpDown size={11} />
                </button>
              </th>
              <th className="text-start px-4 py-3 hidden sm:table-cell">Catégorie</th>
              <th className="text-start px-4 py-3">
                <button onClick={() => toggleSort('price')} className={`flex items-center gap-1 hover:${t.text}`}>
                  Prix <ArrowUpDown size={11} />
                </button>
              </th>
              <th className="text-start px-4 py-3 hidden md:table-cell">
                <button onClick={() => toggleSort('stock')} className={`flex items-center gap-1 hover:${t.text}`}>
                  Stock <ArrowUpDown size={11} />
                </button>
              </th>
              <th className="text-start px-4 py-3 hidden lg:table-cell">Badges</th>
              <th className="text-start px-4 py-3 hidden xl:table-cell">Placement</th>
              <th className="text-start px-4 py-3">Statut</th>
              <th className="text-end px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.map(p => {
              const cat = categories.find(c => c.id === p.category_id);
              const isSelected = selected.has(p.id);
              return (
                <tr key={p.id}
                  className={`border-t ${t.rowBorder} transition-colors ${t.rowHover} ${isSelected ? (isDark ? 'bg-blue-900/20' : 'bg-blue-50/60') : ''} ${!p.is_active ? 'opacity-60' : ''}`}>
                  <td className="px-4 py-3 w-10">
                    <button onClick={() => toggleSelect(p.id)} className={t.textMuted}>
                      {isSelected ? <CheckSquare size={15} className="text-[#1A3C6E]" /> : <Square size={15} />}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-xl overflow-hidden shrink-0 border ${t.cardBorder} ${isDark ? 'bg-gray-800' : 'bg-gray-50'}`}>
                        {p.images?.[0]
                          ? <img src={p.images[0]} alt="" className="w-full h-full object-cover" />
                          : <Package size={18} className={`m-auto mt-3 ${t.textMuted}`} />}
                      </div>
                      <div className="min-w-0">
                        <div className={`font-semibold text-sm ${t.text} truncate max-w-[160px]`}>{p.name_fr}</div>
                        <div className={`text-xs ${t.textMuted} truncate max-w-[160px]`}>{p.name_ar}</div>
                        {p.sku && <div className={`text-[10px] ${t.textMuted} font-mono mt-0.5`}>#{p.sku}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    {cat ? (
                      <span className={`px-2 py-1 rounded-lg text-xs font-medium border ${t.cardBorder} ${t.textSmall}`}>{cat.name_fr}</span>
                    ) : <span className={`text-xs ${t.textMuted}`}>—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className={`font-bold text-sm ${p.sale_price ? 'text-[#1A3C6E]' : t.text}`}>
                      {(p.sale_price || p.price).toLocaleString()} DA
                    </div>
                    {p.sale_price && (
                      <div className={`text-xs line-through ${t.textMuted}`}>{p.price.toLocaleString()} DA</div>
                    )}
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <StockBadge stock={p.stock} threshold={p.low_stock_threshold} />
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <div className="flex gap-1 flex-wrap">
                      {p.is_featured && <Badge color="blue" icon={Star} label="Vedette" />}
                      {p.is_new && <Badge color="purple" icon={Star} label="Nouveau" />}
                      {p.is_best_seller && <Badge color="orange" icon={Star} label="Top" />}
                      {p.is_promo && <Badge color="red" icon={Star} label="Promo" />}
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden xl:table-cell">
                    <div className="flex items-center gap-1.5" title="Accueil · Vedette · New · Best · Promo · Cartables · Trousses">
                      <PlacementDot active={p.show_on_homepage} />
                      <PlacementDot active={p.show_in_featured} />
                      <PlacementDot active={p.show_in_new_arrivals} />
                      <PlacementDot active={p.show_in_best_sellers} />
                      <PlacementDot active={p.show_in_promotions} />
                      <PlacementDot active={p.show_in_cartables} />
                      <PlacementDot active={p.show_in_trousses} />
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => toggleActive(p)}
                      className={`px-2.5 py-1 rounded-full text-xs font-bold transition-colors ${p.is_active ? 'bg-green-100 text-green-700 hover:bg-green-200' : (isDark ? 'bg-gray-700 text-gray-400 hover:bg-gray-600' : 'bg-gray-100 text-gray-500 hover:bg-gray-200')}`}>
                      {p.is_active ? '● Actif' : '○ Inactif'}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                      <button onClick={() => openEdit(p)} title="Modifier"
                        className={`p-1.5 rounded-lg text-[#1A3C6E] hover:bg-[#1A3C6E]/10 transition-colors`}>
                        <Edit2 size={14} />
                      </button>
                      <button onClick={() => toggleFeatured(p)} title={p.is_featured ? "Retirer vedette" : "Mettre en vedette"}
                        className={`p-1.5 rounded-lg transition-colors ${p.is_featured ? 'text-yellow-500 hover:bg-yellow-50' : `${t.textMuted} ${t.rowHover}`}`}>
                        <Star size={14} />
                      </button>
                      <div className="relative">
                        <button onClick={() => setQuickActionMenu(quickActionMenu === p.id ? null : p.id)}
                          className={`p-1.5 rounded-lg ${t.textMuted} ${t.rowHover} transition-colors`}>
                          <MoreHorizontal size={14} />
                        </button>
                        {quickActionMenu === p.id && (
                          <div className={`absolute right-0 top-full mt-1 w-44 ${t.card} border ${t.cardBorder} rounded-xl shadow-xl z-50 py-1 overflow-hidden`}>
                            <button onClick={() => { openEdit(p); setQuickActionMenu(null); }}
                              className={`w-full text-start px-3 py-2 text-xs font-medium ${t.text} ${t.rowHover} flex items-center gap-2`}>
                              <Edit2 size={12} /> Modifier
                            </button>
                            <button onClick={() => { handleDuplicate(p); setQuickActionMenu(null); }}
                              className={`w-full text-start px-3 py-2 text-xs font-medium ${t.text} ${t.rowHover} flex items-center gap-2`}>
                              <Copy size={12} /> Dupliquer
                            </button>
                            <button onClick={() => { toggleActive(p); setQuickActionMenu(null); }}
                              className={`w-full text-start px-3 py-2 text-xs font-medium ${t.text} ${t.rowHover} flex items-center gap-2`}>
                              {p.is_active ? <><EyeOff size={12} /> Désactiver</> : <><Eye size={12} /> Activer</>}
                            </button>
                            <div className={`my-1 border-t ${t.divider}`} />
                            <button onClick={() => { handleDelete(p.id, p.name_fr); setQuickActionMenu(null); }}
                              className="w-full text-start px-3 py-2 text-xs font-medium text-red-500 hover:bg-red-50 flex items-center gap-2">
                              <Trash2 size={12} /> Supprimer
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className={`py-20 text-center ${t.textMuted}`}>
            <Package size={40} className="mx-auto mb-3 opacity-20" />
            <p className="font-semibold">Aucun produit trouvé</p>
            <p className="text-xs mt-1">Essayez de modifier vos filtres</p>
          </div>
        )}
      </div>
      {/* Table footer */}
      {filtered.length > 0 && (
        <div className={`px-4 py-3 border-t ${t.divider} flex items-center justify-between`}>
          <span className={`text-xs ${t.textMuted}`}>{filtered.length} produit(s) affiché(s) sur {products.length}</span>
          <div className="flex items-center gap-1">
            <Monitor size={12} className={t.textMuted} />
            <Smartphone size={12} className={t.textMuted} />
            <span className={`text-xs ${t.textMuted} ml-1`}>Web + App synchronisés</span>
          </div>
        </div>
      )}
    </div>
  );
}
