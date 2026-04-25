// Editor for the "Pourquoi nous choisir" section.
// Admin can add/remove/tune up to 12 trust items (≥3 required). Each item
// carries bilingual value + label, an icon key (maps to a lucide icon on
// the storefront), and an accent color.
import React from 'react';
import { Plus, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import { toast } from 'sonner';
import { LabeledInput } from './BilingualFields';
import { normalizeSafeText } from '../../../../../lib/textPipeline';
import type { TrustItem } from '../types';

const TRUST_ICON_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'shield', label: 'Bouclier' },
  { value: 'truck', label: 'Camion' },
  { value: 'award', label: 'Trophée' },
  { value: 'users', label: 'Clients' },
  { value: 'package', label: 'Colis' },
  { value: 'clock', label: 'Horloge' },
  { value: 'star', label: 'Étoile' },
  { value: 'heart', label: 'Cœur' },
  { value: 'credit-card', label: 'Paiement' },
  { value: 'headphones', label: 'Support' },
];

type Props = {
  items: TrustItem[];
  onChange: (items: TrustItem[]) => void;
};

export function TrustItemsEditor({ items, onChange }: Props) {
  const updateItem = (index: number, patch: Partial<TrustItem>) => {
    onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };
  const removeItem = (index: number) => {
    if (items.length <= 3) {
      toast.error('Au moins 3 éléments sont requis pour la section confiance.');
      return;
    }
    onChange(items.filter((_, i) => i !== index));
  };
  const addItem = () => {
    if (items.length >= 12) {
      toast.error('Maximum 12 éléments.');
      return;
    }
    onChange([
      ...items,
      {
        id: `trust-${Date.now().toString(36)}`,
        icon: 'shield',
        value_fr: '',
        value_ar: '',
        label_fr: '',
        label_ar: '',
        color: '#0EA5E9',
      },
    ]);
  };
  const moveItem = (from: number, direction: 'up' | 'down') => {
    const to = direction === 'up' ? from - 1 : from + 1;
    if (to < 0 || to >= items.length) return;
    const next = [...items];
    [next[from], next[to]] = [next[to], next[from]];
    onChange(next);
  };

  return (
    <div className="space-y-3 rounded-2xl border border-sky-200 bg-sky-50/40 p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-black uppercase tracking-wide text-sky-700">
          Éléments de confiance ({items.length}/12)
        </p>
        <button
          type="button"
          onClick={addItem}
          className="inline-flex items-center gap-1 rounded-xl bg-sky-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-sky-700"
        >
          <Plus size={12} />
          Ajouter
        </button>
      </div>

      {items.length === 0 && (
        <p className="text-xs text-gray-500">Aucun élément. Cliquez sur "Ajouter".</p>
      )}

      {items.map((item, index) => (
        <div key={item.id || index} className="space-y-2 rounded-xl border border-sky-100 bg-white p-3">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-black uppercase tracking-wide text-gray-500">#{index + 1}</p>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => moveItem(index, 'up')}
                disabled={index === 0}
                className="rounded-lg p-1 text-gray-500 hover:bg-gray-100 disabled:opacity-40"
              >
                <ArrowUp size={12} />
              </button>
              <button
                type="button"
                onClick={() => moveItem(index, 'down')}
                disabled={index === items.length - 1}
                className="rounded-lg p-1 text-gray-500 hover:bg-gray-100 disabled:opacity-40"
              >
                <ArrowDown size={12} />
              </button>
              <button
                type="button"
                onClick={() => removeItem(index)}
                className="rounded-lg p-1 text-red-500 hover:bg-red-50"
                title="Supprimer"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>

          <div className="grid gap-2 md:grid-cols-2">
            <label className="space-y-1 text-xs font-semibold text-gray-600">
              <span>Icône</span>
              <select
                value={item.icon}
                onChange={(e) => updateItem(index, { icon: e.target.value })}
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
              >
                {TRUST_ICON_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-xs font-semibold text-gray-600">
              <span>Couleur accent</span>
              <input
                type="color"
                value={item.color || '#0EA5E9'}
                onChange={(e) => updateItem(index, { color: e.target.value })}
                className="h-9 w-full rounded-xl border border-gray-200 bg-white"
              />
            </label>
          </div>

          <div className="grid gap-2 md:grid-cols-2">
            <LabeledInput
              label="Valeur FR (ex: 15 000+)"
              value={item.value_fr}
              onChange={(v) => updateItem(index, { value_fr: normalizeSafeText(v, '') })}
              placeholder="15 000+"
            />
            <LabeledInput
              label="القيمة (AR)"
              dir="rtl"
              value={item.value_ar}
              onChange={(v) => updateItem(index, { value_ar: normalizeSafeText(v, '') })}
              placeholder="+15 000"
            />
          </div>

          <div className="grid gap-2 md:grid-cols-2">
            <LabeledInput
              label="Libellé FR"
              value={item.label_fr}
              onChange={(v) => updateItem(index, { label_fr: normalizeSafeText(v, '') })}
              placeholder="Commandes livrées"
            />
            <LabeledInput
              label="العنوان (AR)"
              dir="rtl"
              value={item.label_ar}
              onChange={(v) => updateItem(index, { label_ar: normalizeSafeText(v, '') })}
              placeholder="طلبات مسلمة"
            />
          </div>
        </div>
      ))}
    </div>
  );
}
