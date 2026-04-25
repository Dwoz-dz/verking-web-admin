// Multi-slot media gallery editor — admin can stack up to 8 images or
// videos per section. Each slot is a shared MediaField so the admin gets
// the same UX everywhere: media library dropdown, image upload, video
// upload, direct URL, and live preview. Reorder arrows + remove per slot.
// The storefront cycles through this list as a backdrop (SectionMediaBackdrop).
//
// IMPORTANT — Local state for in-progress empty slots:
// The upstream normalizer (normalizeSection.images) strips empty strings
// because they're not valid URLs. That's correct for persistence, but it
// means we can't store a blank "+ Ajouter" placeholder in the parent state.
// We keep local state here so admins can click "+ Ajouter", see an empty
// slot appear, and fill it via MediaField — only non-empty URLs are emitted
// upstream via onChange.
import React, { useEffect, useRef, useState } from 'react';
import { Plus, ArrowUp, ArrowDown, Trash2, Images as ImagesIcon } from 'lucide-react';
import { toast } from 'sonner';
import { MediaField } from './MediaField';
import type { MediaItem } from '../types';

type Props = {
  label?: string;
  value: string[];
  onChange: (next: string[]) => void;
  media: MediaItem[];
  /** Tailwind aspect class applied to each slot's preview. */
  aspectClass?: string;
  /** Max number of slots (default 8). */
  max?: number;
  lang?: 'fr' | 'ar';
};

export function MediaGalleryField({
  label,
  value,
  onChange,
  media,
  aspectClass = 'aspect-video',
  max = 8,
  lang = 'fr',
}: Props) {
  // Local mirror that preserves empty placeholder slots. Upstream `value`
  // is always the cleaned non-empty list (post-normalizer).
  const [slots, setSlots] = useState<string[]>(() =>
    Array.isArray(value) ? value.filter((u): u is string => typeof u === 'string') : [],
  );
  // Tracks the last list we emitted so we don't loop on prop sync.
  const lastEmittedRef = useRef<string>(
    (Array.isArray(value) ? value : []).filter(Boolean).join('|'),
  );

  // Resync when upstream value changes (other admin tab, server load, etc.)
  // while preserving any trailing empty slots the user is currently filling.
  useEffect(() => {
    const upstream = (Array.isArray(value) ? value : []).filter(
      (u): u is string => typeof u === 'string' && u.length > 0,
    );
    const upstreamKey = upstream.join('|');
    const persistedLocal = slots.filter((u) => typeof u === 'string' && u.length > 0);
    const localKey = persistedLocal.join('|');
    if (upstreamKey === lastEmittedRef.current && localKey === upstreamKey) return;
    const trailingEmpties = Math.max(0, slots.length - persistedLocal.length);
    const next = trailingEmpties > 0
      ? [...upstream, ...new Array(trailingEmpties).fill('')]
      : upstream;
    setSlots(next);
    lastEmittedRef.current = upstreamKey;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const persist = (next: string[]) => {
    setSlots(next);
    const cleaned = next.filter(
      (u): u is string => typeof u === 'string' && u.length > 0,
    );
    const key = cleaned.join('|');
    if (key !== lastEmittedRef.current) {
      lastEmittedRef.current = key;
      onChange(cleaned);
    }
  };

  const updateAt = (i: number, url: string) => {
    const next = [...slots];
    next[i] = url;
    persist(next);
  };
  const removeAt = (i: number) => {
    const next = slots.filter((_, idx) => idx !== i);
    persist(next);
  };
  const move = (from: number, dir: 'up' | 'down') => {
    const to = dir === 'up' ? from - 1 : from + 1;
    if (to < 0 || to >= slots.length) return;
    const next = [...slots];
    [next[from], next[to]] = [next[to], next[from]];
    persist(next);
  };
  const addSlot = () => {
    if (slots.length >= max) {
      toast.error(
        lang === 'ar'
          ? `الحد الأقصى ${max} عناصر`
          : `Maximum ${max} médias.`,
      );
      return;
    }
    // Append empty placeholder locally — the parent only sees this once
    // the user picks a real URL through MediaField → updateAt.
    setSlots((prev) => [...prev, '']);
  };

  return (
    <div className="space-y-3 rounded-2xl border border-sky-200 bg-sky-50/40 p-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wide text-sky-700">
            <ImagesIcon size={12} />
            {label || (lang === 'ar' ? 'معرض الخلفيات' : 'Galerie de fonds')}
            <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] text-sky-800">
              {slots.length}/{max}
            </span>
          </p>
          <p className="mt-1 text-[11px] text-gray-600">
            {lang === 'ar'
              ? 'يمكنك إضافة عدة صور أو فيديوهات. سيتم تشغيلها تلقائياً كخلفية متحركة.'
              : 'Ajoutez plusieurs images ou vidéos — elles défileront automatiquement en arrière-plan.'}
          </p>
        </div>
        <button
          type="button"
          onClick={addSlot}
          disabled={slots.length >= max}
          className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-sky-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-sky-600 disabled:opacity-50"
        >
          <Plus size={12} />
          {lang === 'ar' ? 'إضافة' : 'Ajouter'}
        </button>
      </div>

      {slots.length === 0 && (
        <div className="rounded-xl border border-dashed border-sky-300 bg-white/50 p-6 text-center text-xs text-sky-600">
          {lang === 'ar'
            ? 'لا توجد وسائط متعددة. استخدم الصورة الواحدة فوق أو أضف شرائح هنا.'
            : 'Aucun média multi-slide. Utilisez l\'image unique ci-dessus, ou ajoutez des slides ici.'}
        </div>
      )}

      {slots.map((url, i) => (
        <div key={i} className="space-y-2 rounded-xl border border-sky-100 bg-white p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-black uppercase tracking-wide text-gray-500">
              {lang === 'ar' ? `الشريحة #${i + 1}` : `Slide #${i + 1}`}
            </p>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => move(i, 'up')}
                disabled={i === 0}
                className="rounded-lg p-1 text-gray-500 hover:bg-gray-100 disabled:opacity-40"
                title={lang === 'ar' ? 'للأعلى' : 'Monter'}
              >
                <ArrowUp size={12} />
              </button>
              <button
                type="button"
                onClick={() => move(i, 'down')}
                disabled={i === slots.length - 1}
                className="rounded-lg p-1 text-gray-500 hover:bg-gray-100 disabled:opacity-40"
                title={lang === 'ar' ? 'للأسفل' : 'Descendre'}
              >
                <ArrowDown size={12} />
              </button>
              <button
                type="button"
                onClick={() => removeAt(i)}
                className="rounded-lg p-1 text-red-500 hover:bg-red-50"
                title={lang === 'ar' ? 'حذف' : 'Supprimer'}
              >
                <Trash2 size={12} />
              </button>
            </div>
          </div>
          <MediaField
            value={url}
            onChange={(nextUrl) => updateAt(i, nextUrl)}
            media={media}
            allow="both"
            aspectClass={aspectClass}
            lang={lang}
          />
        </div>
      ))}
    </div>
  );
}
