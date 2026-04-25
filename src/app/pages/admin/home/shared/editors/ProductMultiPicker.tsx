// Multi-select editor for product-driven homepage sections (Produits
// vedettes / Nouveautés / Best sellers / Promotions). Replaces the
// single-select SourcePicker for these sections so admins can hand-pick
// MULTIPLE specific products to appear on the storefront.
//
// Wire format:
//   • selected_product_ids (string[])  — the source of truth; round-trips
//     through Supabase via the normalizer.
//   • source_mode = 'products'         — locked; the resolver uses this
//     to know it should consult selected_product_ids.
//   • source_ref (CSV string)          — kept in sync with the IDs for
//     backward-compatibility with the legacy CSV resolver, AND so any
//     preset slug ("featured", "new_arrivals", …) the admin opts into
//     still works for flag-based fallback.
//   • limit (number)                   — max products rendered.
//
// What the admin sees:
//   1. Preset chips at top — toggle "all products with X flag".
//   2. A search-filterable list of every active product, click to pick.
//   3. A reorderable, removable list of currently picked products.
//   4. A live count + a clear "no products selected" empty state.
import React, { useMemo, useState } from 'react';
import { ChevronUp, ChevronDown, X, Search, Plus, Check, AlertTriangle } from 'lucide-react';
import type { ProductLookup } from '../types';

const PRESETS = [
  { value: 'featured',     labelFr: 'Tous les produits "vedette"',         labelAr: 'كل المنتجات "مختارة"' },
  { value: 'new_arrivals', labelFr: 'Tous les produits "nouveautés"',      labelAr: 'كل المنتجات "وصل حديثاً"' },
  { value: 'best_sellers', labelFr: 'Tous les produits "best sellers"',    labelAr: 'كل المنتجات "الأكثر مبيعاً"' },
  { value: 'promotions',   labelFr: 'Tous les produits en promo',          labelAr: 'كل المنتجات في تخفيض' },
  { value: 'all',          labelFr: 'Tous les produits actifs',            labelAr: 'كل المنتجات النشطة' },
];

type Props = {
  selectedIds: string[];
  presets: string[];
  limit: number;
  products: ProductLookup[];
  lang: 'fr' | 'ar';
  /** Propagates the change as a single patch so the hub mirrors
   *  source_ref + selected_product_ids together. */
  onChange: (patch: { selected_product_ids: string[]; source_ref: string; limit?: number }) => void;
};

function buildSourceRef(presets: string[], ids: string[]): string {
  // Presets first so the legacy resolver applies them before manual IDs.
  return [...presets, ...ids].join(',');
}

export function ProductMultiPicker({
  selectedIds,
  presets,
  limit,
  products,
  lang,
  onChange,
}: Props) {
  const [search, setSearch] = useState('');

  const productById = useMemo(() => {
    const map = new Map<string, ProductLookup>();
    products.forEach((p) => map.set(p.id, p));
    return map;
  }, [products]);

  const visibleProducts = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return products.slice(0, 60);
    return products
      .filter((p) => {
        const haystack = `${p.name_fr || ''} ${p.name_ar || ''} ${p.id}`.toLowerCase();
        return haystack.includes(needle);
      })
      .slice(0, 60);
  }, [products, search]);

  const togglePreset = (value: string) => {
    const next = presets.includes(value)
      ? presets.filter((p) => p !== value)
      : [...presets, value];
    onChange({
      selected_product_ids: selectedIds,
      source_ref: buildSourceRef(next, selectedIds),
    });
  };

  const addProduct = (id: string) => {
    if (selectedIds.includes(id)) return;
    const next = [...selectedIds, id];
    onChange({
      selected_product_ids: next,
      source_ref: buildSourceRef(presets, next),
    });
  };

  const removeProduct = (id: string) => {
    const next = selectedIds.filter((entry) => entry !== id);
    onChange({
      selected_product_ids: next,
      source_ref: buildSourceRef(presets, next),
    });
  };

  const moveProduct = (id: string, direction: -1 | 1) => {
    const idx = selectedIds.indexOf(id);
    const target = idx + direction;
    if (idx < 0 || target < 0 || target >= selectedIds.length) return;
    const next = [...selectedIds];
    [next[idx], next[target]] = [next[target], next[idx]];
    onChange({
      selected_product_ids: next,
      source_ref: buildSourceRef(presets, next),
    });
  };

  const clearAll = () => {
    onChange({
      selected_product_ids: [],
      source_ref: buildSourceRef(presets, []),
    });
  };

  const updateLimit = (n: number) => {
    onChange({
      selected_product_ids: selectedIds,
      source_ref: buildSourceRef(presets, selectedIds),
      limit: Math.max(1, Math.min(48, Math.round(n))),
    });
  };

  const hasNoSelection = selectedIds.length === 0 && presets.length === 0;
  const ar = lang === 'ar';

  return (
    <div className="space-y-4" dir={ar ? 'rtl' : 'ltr'}>
      {/* Preset toggles — flag-based "groups" */}
      <div className="space-y-2">
        <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
          {ar ? 'مجموعات تلقائية' : 'Groupes automatiques'}
        </p>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => {
            const active = presets.includes(p.value);
            return (
              <button
                key={p.value}
                type="button"
                onClick={() => togglePreset(p.value)}
                className={[
                  'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition',
                  active
                    ? 'border-blue-700 bg-blue-700 text-white shadow-sm'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50',
                ].join(' ')}
              >
                {active ? <Check size={13} /> : <Plus size={13} />}
                {ar ? p.labelAr : p.labelFr}
              </button>
            );
          })}
        </div>
      </div>

      {/* Manual product picker — searchable, paginated */}
      <div className="space-y-2 rounded-xl border border-gray-200 bg-gray-50/60 p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
            {ar ? 'اختيار يدوي للمنتجات' : 'Sélection manuelle de produits'}
          </p>
          <span className="text-[11px] font-bold text-gray-500">
            {ar ? `${selectedIds.length} مختار` : `${selectedIds.length} sélectionné(s)`}
          </span>
        </div>
        <label className="relative block">
          <Search size={14} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={ar ? 'ابحث عن منتج بالاسم…' : 'Rechercher un produit par nom…'}
            className="w-full rounded-lg border border-gray-200 bg-white py-2 ps-9 pe-3 text-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none"
          />
        </label>
        <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border border-gray-200 bg-white p-1">
          {visibleProducts.length === 0 ? (
            <p className="p-3 text-center text-xs text-gray-500">
              {ar ? 'لا توجد منتجات مطابقة.' : 'Aucun produit trouvé.'}
            </p>
          ) : (
            visibleProducts.map((p) => {
              const picked = selectedIds.includes(p.id);
              const name = ar ? p.name_ar || p.name_fr : p.name_fr || p.name_ar;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => (picked ? removeProduct(p.id) : addProduct(p.id))}
                  className={[
                    'flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-start text-xs transition',
                    picked
                      ? 'bg-blue-50 text-blue-900'
                      : 'text-gray-700 hover:bg-gray-50',
                  ].join(' ')}
                >
                  <span className="truncate font-semibold">{name || p.id}</span>
                  <span
                    className={[
                      'inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border',
                      picked
                        ? 'border-blue-700 bg-blue-700 text-white'
                        : 'border-gray-300 bg-white text-gray-400',
                    ].join(' ')}
                  >
                    {picked ? <Check size={11} /> : <Plus size={11} />}
                  </span>
                </button>
              );
            })
          )}
        </div>
        {products.length > visibleProducts.length && !search && (
          <p className="text-[10px] text-gray-500">
            {ar
              ? `يتم عرض ${visibleProducts.length} من أصل ${products.length}. استخدم البحث لرؤية المزيد.`
              : `${visibleProducts.length} affichés sur ${products.length}. Utilisez la recherche pour en voir plus.`}
          </p>
        )}
      </div>

      {/* Selected products — ordered, removable */}
      {selectedIds.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
              {ar ? 'المنتجات المختارة (بالترتيب)' : 'Produits sélectionnés (ordre d’affichage)'}
            </p>
            <button
              type="button"
              onClick={clearAll}
              className="text-[11px] font-bold text-red-600 hover:underline"
            >
              {ar ? 'مسح الكل' : 'Tout effacer'}
            </button>
          </div>
          <ol className="space-y-1">
            {selectedIds.map((id, idx) => {
              const product = productById.get(id);
              const name = product
                ? (ar ? product.name_ar || product.name_fr : product.name_fr || product.name_ar) || id
                : id;
              const stale = !product;
              return (
                <li
                  key={id}
                  className={[
                    'flex items-center gap-2 rounded-lg border px-2 py-1.5 text-xs',
                    stale ? 'border-amber-200 bg-amber-50' : 'border-gray-200 bg-white',
                  ].join(' ')}
                >
                  <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-700 text-[10px] font-black text-white">
                    {idx + 1}
                  </span>
                  <span className={`flex-1 truncate font-semibold ${stale ? 'text-amber-800' : 'text-gray-800'}`}>
                    {name}
                    {stale && (
                      <span className="ms-1 text-[10px] font-bold text-amber-700">
                        {ar ? '(غير موجود)' : '(introuvable)'}
                      </span>
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={() => moveProduct(id, -1)}
                    disabled={idx === 0}
                    className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-40"
                    aria-label={ar ? 'تحريك للأعلى' : 'Monter'}
                  >
                    <ChevronUp size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveProduct(id, 1)}
                    disabled={idx === selectedIds.length - 1}
                    className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-40"
                    aria-label={ar ? 'تحريك للأسفل' : 'Descendre'}
                  >
                    <ChevronDown size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeProduct(id)}
                    className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                    aria-label={ar ? 'إزالة' : 'Retirer'}
                  >
                    <X size={13} />
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
      )}

      {/* Limit + empty-state warning */}
      <div className="grid gap-3 md:grid-cols-2">
        <label className="block space-y-1 text-xs font-semibold text-gray-600">
          <span>{ar ? 'الحد الأقصى للعرض' : 'Limite (max produits)'}</span>
          <input
            type="number"
            min={1}
            max={48}
            value={limit}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (Number.isFinite(n)) updateLimit(n);
            }}
            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
          />
        </label>
        {hasNoSelection && (
          <div className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <p className="font-semibold">
              {ar
                ? 'لم يتم اختيار أي منتج. لن يظهر هذا القسم على الصفحة الرئيسية حتى تختار منتجات أو تفعّل مجموعة.'
                : 'Aucun produit sélectionné. Cette section restera masquée sur la homepage tant qu’aucun produit ou groupe n’est choisi.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
