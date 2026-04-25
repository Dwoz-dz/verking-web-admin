// Hub card — one per homepage section. Drives:
//   • drag handle + up/down buttons for reorder
//   • enable/disable toggle (auto-persists to Supabase)
//   • "Gérer →" CTA: deep-link to the dedicated sub-page when available,
//     otherwise fall back to the legacy /admin/homepage editor + hash anchor.
// Every interaction is wired through the shared useHomepageConfig hook so
// the Hub, the sub-pages, and the live storefront stay perfectly in sync.
import React, { useState } from 'react';
import { ArrowUp, ArrowDown, GripVertical, ArrowRight, Eye, EyeOff, Loader2, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import type { HomepageSection, SectionKey } from './types';
import { SECTION_META } from './meta';
import { useLang } from '../../../../context/LanguageContext';

type Props = {
  sectionKey: SectionKey;
  section: HomepageSection;
  index: number;
  total: number;
  dragging: boolean;
  dragOver: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDragOver: (event: React.DragEvent<HTMLDivElement>) => void;
  onDrop: () => void;
  onToggleEnabled: (next: boolean) => Promise<void>;
};

export function SectionCard({
  sectionKey,
  section,
  index,
  total,
  dragging,
  dragOver,
  onMoveUp,
  onMoveDown,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  onToggleEnabled,
}: Props) {
  const meta = SECTION_META[sectionKey];
  const { lang } = useLang();
  const [toggling, setToggling] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  const Icon = meta.icon;
  const label = lang === 'ar' ? meta.labelAr : meta.labelFr;
  const hint = lang === 'ar' ? meta.hintAr : meta.hintFr;
  const manageHref = meta.hasDedicatedPage
    ? `/admin/home/${meta.slug}`
    : `/admin/homepage#section-${sectionKey}`;

  const handleToggle = async () => {
    setToggling(true);
    try {
      await onToggleEnabled(!section.enabled);
      setJustSaved(true);
      window.setTimeout(() => setJustSaved(false), 1800);
    } catch {
      toast.error(lang === 'ar' ? 'فشل الحفظ' : 'Sauvegarde échouée');
    } finally {
      setToggling(false);
    }
  };

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={[
        'group relative flex flex-col overflow-hidden rounded-2xl border bg-white shadow-sm transition-all',
        'hover:-translate-y-0.5 hover:shadow-lg',
        dragging ? 'opacity-40 scale-[0.98]' : '',
        dragOver ? 'ring-2 ring-offset-2 ring-blue-400' : 'border-gray-200',
        !section.enabled ? 'opacity-85' : '',
      ].join(' ')}
      style={{
        boxShadow: dragging
          ? undefined
          : `0 1px 0 ${meta.color}12, 0 10px 24px -18px ${meta.color}33`,
      }}
    >
      {/* Top accent strip */}
      <div
        className="h-1.5 w-full"
        style={{ background: `linear-gradient(90deg, ${meta.color} 0%, ${meta.color}55 100%)` }}
        aria-hidden
      />

      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <span
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white shadow-sm"
            style={{ backgroundColor: meta.color }}
          >
            <Icon size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-sm font-black text-gray-900">{label}</h3>
              <span
                className={[
                  'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold',
                  section.enabled
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-gray-100 text-gray-500 border border-gray-200',
                ].join(' ')}
              >
                {section.enabled
                  ? lang === 'ar' ? 'مفعّل' : 'Actif'
                  : lang === 'ar' ? 'معطّل' : 'Désactivé'}
              </span>
              <span className="shrink-0 rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-[10px] font-semibold text-gray-600">
                #{index + 1}
              </span>
            </div>
            <p className="mt-1 line-clamp-2 text-xs leading-snug text-gray-600">{hint}</p>
          </div>
          <span className="hidden sm:flex h-8 w-8 shrink-0 cursor-grab items-center justify-center rounded-lg text-gray-400 hover:bg-gray-50 active:cursor-grabbing">
            <GripVertical size={16} />
          </span>
        </div>

        {/* Footer */}
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={index === 0}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-40"
            aria-label={lang === 'ar' ? 'نقل لأعلى' : 'Monter'}
          >
            <ArrowUp size={14} />
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={index === total - 1}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-40"
            aria-label={lang === 'ar' ? 'نقل لأسفل' : 'Descendre'}
          >
            <ArrowDown size={14} />
          </button>

          <button
            type="button"
            onClick={handleToggle}
            disabled={toggling}
            className={[
              'ml-1 inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-bold transition-colors',
              section.enabled
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50',
              toggling ? 'opacity-60' : '',
            ].join(' ')}
          >
            {toggling ? (
              <Loader2 size={12} className="animate-spin" />
            ) : justSaved ? (
              <CheckCircle2 size={12} />
            ) : section.enabled ? (
              <Eye size={12} />
            ) : (
              <EyeOff size={12} />
            )}
            {section.enabled
              ? lang === 'ar' ? 'مرئي' : 'Visible'
              : lang === 'ar' ? 'مخفي' : 'Caché'}
          </button>

          <Link
            to={manageHref}
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-black text-white shadow-sm transition-colors hover:opacity-90"
            style={{ backgroundColor: meta.color }}
          >
            {meta.hasDedicatedPage
              ? lang === 'ar' ? 'إدارة' : 'Gérer'
              : lang === 'ar' ? 'محرر قديم' : 'Éditeur'}
            <ArrowRight size={12} className={lang === 'ar' ? 'rotate-180' : ''} />
          </Link>
        </div>
      </div>
    </div>
  );
}
