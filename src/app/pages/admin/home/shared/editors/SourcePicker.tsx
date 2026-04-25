// Source-reference picker — lets the admin choose:
//   • a preset source_ref slug (featured, new_arrivals, best_sellers, etc.)
//   • OR a specific product / category / banner from the live Supabase data
// Plus a limit field for product-driven carousels. Wired through setPatch
// so every change flows into useHomepageConfig → draftConfig.
import React from 'react';
import type { BannerLookup, CategoryLookup, ProductLookup, SourceMode } from '../types';

const PRODUCT_PRESETS = [
  { value: 'featured', label: 'Produits vedettes' },
  { value: 'new_arrivals', label: 'Nouveautés' },
  { value: 'best_sellers', label: 'Best sellers' },
  { value: 'promotions', label: 'Promotions' },
  { value: 'all', label: 'Tous les produits' },
];

const CATEGORY_PRESETS = [
  { value: 'homepage', label: 'Catégories homepage' },
  { value: 'all', label: 'Toutes les catégories' },
];

const BANNER_PRESETS = [
  { value: 'homepage_hero', label: 'Placement: Homepage hero' },
  { value: 'homepage_secondary', label: 'Placement: Homepage secondary' },
  { value: 'promotion_strip', label: 'Placement: Promotion strip' },
  { value: 'category_banner', label: 'Placement: Category banner' },
];

const SOURCE_MODES: Array<{ value: SourceMode; label: string }> = [
  { value: 'manual', label: 'Manuel' },
  { value: 'products', label: 'Produits' },
  { value: 'categories', label: 'Catégories' },
  { value: 'banners', label: 'Bannières' },
];

type Props = {
  sourceMode: SourceMode;
  sourceRef: string;
  limit?: number;
  products: ProductLookup[];
  categories: CategoryLookup[];
  banners: BannerLookup[];
  lockedMode?: SourceMode;
  showLimit?: boolean;
  onChange: (patch: { source_mode?: SourceMode; source_ref?: string; limit?: number }) => void;
};

export function SourcePicker({
  sourceMode,
  sourceRef,
  limit,
  products,
  categories,
  banners,
  lockedMode,
  showLimit = true,
  onChange,
}: Props) {
  const effectiveMode = lockedMode || sourceMode;

  const presets = effectiveMode === 'products'
    ? [...PRODUCT_PRESETS, ...products.map((p) => ({ value: p.id, label: `Produit: ${p.name_fr || p.name_ar || p.id}` }))]
    : effectiveMode === 'categories'
    ? [...CATEGORY_PRESETS, ...categories.map((c) => ({ value: c.id, label: `Catégorie: ${c.name_fr || c.name_ar || c.id}` }))]
    : effectiveMode === 'banners'
    ? [...BANNER_PRESETS, ...banners.filter((b) => b.is_active).map((b) => ({ value: b.id, label: `Bannière: ${b.title_fr || b.title_ar || b.id}` }))]
    : [];

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {!lockedMode && (
        <label className="block space-y-1 text-xs font-semibold text-gray-600">
          <span>Mode source</span>
          <select
            value={sourceMode}
            onChange={(e) => onChange({ source_mode: e.target.value as SourceMode, source_ref: '' })}
            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
          >
            {SOURCE_MODES.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </label>
      )}

      {effectiveMode !== 'manual' && (
        <label className="block space-y-1 text-xs font-semibold text-gray-600">
          <span>Référence source</span>
          <select
            value={sourceRef}
            onChange={(e) => onChange({ source_ref: e.target.value })}
            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
          >
            <option value="">— Choisir —</option>
            {presets.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </label>
      )}

      {showLimit && effectiveMode === 'products' && (
        <label className="block space-y-1 text-xs font-semibold text-gray-600">
          <span>Limite (max produits)</span>
          <input
            type="number"
            min={1}
            max={48}
            value={limit ?? 8}
            onChange={(e) => {
              const n = Number(e.target.value);
              onChange({ limit: Number.isFinite(n) ? Math.max(1, Math.min(48, Math.round(n))) : 8 });
            }}
            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
          />
        </label>
      )}
    </div>
  );
}
